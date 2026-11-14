import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { tasks } from '@/server/db/schema';
import { createAgentConnection, updateAgentGrants } from '@/server/agents';
import { listBlockers, resolveBlocker } from '@/server/blockers';
import { cancelHandoff, listHandoffs } from '@/server/handoffs';
import { createProject } from '@/server/projects';
import { createTask, getTaskDetail, listBoardTasks } from '@/server/tasks';
import { call } from './mcp-client';
import { seedOwner } from './helpers';

async function setup() {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'Website' });
  const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
  const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });
  const task = await createTask(owner, { boardId: a.board.id, title: 'API wiring', status: 'todo', assigneeAgentId: claude.agent.id });
  await call(claude.token, 'accept_task', { task_id: task.id });
  return { owner, a, claude, codex, task };
}

const propose = (token: string, taskId: string, to: string, extra: Record<string, unknown> = {}) =>
  call(token, 'propose_handoff', {
    task_id: taskId, to_agent_id: to, reason: 'Codex owns the API', work_completed: 'Scaffolded client', next_action: 'Add auth header', ...extra,
  });
const assignee = async (taskId: string) => (await db.select().from(tasks).where(eq(tasks.id, taskId)))[0].assigneeAgentId;

describe('handoffs', () => {
  it('ownership stays with the sender until the recipient accepts; then moves with history', async () => {
    const { owner, a, claude, codex, task } = await setup();
    const p = await propose(claude.token, task.id, codex.agent.id);
    expect(p.isError).toBe(false);
    expect(await assignee(task.id)).toBe(claude.agent.id);

    const [card] = await listBoardTasks(owner, a.board.id);
    expect(card.badges).toContain('handoff_pending');
    expect(card.handoffTo).toBe('Codex');

    const offered = await call(codex.token, 'list_assignments');
    expect(offered.data.handoffs_to_me).toEqual([expect.objectContaining({ id: p.data.id, from: 'Claude Code', next_action: 'Add auth header' })]);

    const accepted = await call(codex.token, 'respond_to_handoff', { handoff_id: p.data.id, decision: 'accept' });
    expect(accepted.data.task).toMatchObject({ status: 'in_progress', assignee_agent_id: codex.agent.id });
    expect(await assignee(task.id)).toBe(codex.agent.id);
    const detail = await getTaskDetail(owner, task.id);
    expect(detail.nextAction).toBe('Add auth header');
    expect(detail.history.map((h) => h.type).slice(0, 2)).toEqual(['handoff.accepted', 'handoff.proposed']);
    expect((await listHandoffs(task.id))[0]).toMatchObject({ status: 'accepted', from: { name: 'Claude Code' }, to: { name: 'Codex' } });

    // The previous owner can no longer act on the task.
    expect((await call(claude.token, 'post_update', { task_id: task.id, body: 'late' })).data.error.code).toBe('CONFLICT');
  });

  it('decline and owner cancel keep the current owner; only one pending handoff at a time', async () => {
    const { owner, claude, codex, task } = await setup();
    const p1 = await propose(claude.token, task.id, codex.agent.id);
    expect((await propose(claude.token, task.id, codex.agent.id)).data.error.code).toBe('CONFLICT');
    await call(codex.token, 'respond_to_handoff', { handoff_id: p1.data.id, decision: 'decline', reason: 'Busy' });
    expect(await assignee(task.id)).toBe(claude.agent.id);
    expect((await listHandoffs(task.id))[0]).toMatchObject({ status: 'declined', declineReason: 'Busy' });

    const p2 = await propose(claude.token, task.id, codex.agent.id);
    await cancelHandoff(owner, { handoffId: p2.data.id });
    expect(await assignee(task.id)).toBe(claude.agent.id);
    const late = await call(codex.token, 'respond_to_handoff', { handoff_id: p2.data.id, decision: 'accept' });
    expect(late.data.error.code).toBe('CONFLICT');
  });

  it('rejects bad proposals and responses', async () => {
    const { owner, a, claude, codex, task } = await setup();
    const other = await createProject(owner, { name: 'Other' });
    const outsider = await createAgentConnection(owner, { name: 'Outsider', client: 'other', projectIds: [other.project.id] });
    expect((await propose(codex.token, task.id, claude.agent.id)).data.error.code).toBe('CONFLICT'); // not the owner
    expect((await propose(claude.token, task.id, claude.agent.id)).data.error.code).toBe('VALIDATION'); // self
    expect((await propose(claude.token, task.id, outsider.agent.id)).data.error.code).toBe('VALIDATION'); // no access
    expect((await propose(claude.token, task.id, codex.agent.id, { work_completed: '  ' })).data.error.code).toBe('VALIDATION');

    const p = await propose(claude.token, task.id, codex.agent.id);
    expect((await call(claude.token, 'respond_to_handoff', { handoff_id: p.data.id, decision: 'accept' })).data.error.code).toBe('NOT_FOUND');
    // Recipient loses access before accepting: the pending handoff is cancelled (D-11) and acceptance fails.
    await updateAgentGrants(owner, { agentId: codex.agent.id, projectIds: [] });
    const res = await call(codex.token, 'respond_to_handoff', { handoff_id: p.data.id, decision: 'accept' });
    expect(res.data.error.code).toBe('NOT_FOUND');
    expect((await listHandoffs(task.id))[0].status).toBe('cancelled');
    void a;
  });

  it('a stale handoff (sender no longer owns the task) cannot be accepted', async () => {
    const { claude, codex, task } = await setup();
    const p = await propose(claude.token, task.id, codex.agent.id);
    await db.update(tasks).set({ status: 'todo' }).where(eq(tasks.id, task.id)); // e.g. owner reopened/reassigned
    expect((await call(codex.token, 'respond_to_handoff', { handoff_id: p.data.id, decision: 'accept' })).data.error.code).toBe('CONFLICT');
  });
});

describe('blockers', () => {
  it('reporting sets Blocked; clearing removes it and records history', async () => {
    const { owner, a, claude, task } = await setup();
    const r = await call(claude.token, 'report_blocker', {
      task_id: task.id, reason: 'No repo access', question: 'Can you add me as a collaborator?', missing_resource: 'write access to acme/api',
    });
    expect(r.isError).toBe(false);
    expect((await listBoardTasks(owner, a.board.id))[0].badges).toContain('blocked');
    const [b] = await listBlockers(task.id);
    expect(b).toMatchObject({ status: 'open', needs: 'Owner', raisedBy: { name: 'Claude Code' }, missingResource: 'write access to acme/api' });

    const detail = await call(claude.token, 'get_task', { task_id: task.id });
    expect(detail.data.blockers[0]).toMatchObject({ status: 'open', question: 'Can you add me as a collaborator?' });

    await call(claude.token, 'clear_blocker', { blocker_id: r.data.id, resolution: 'Access granted' });
    expect((await listBoardTasks(owner, a.board.id))[0].badges).not.toContain('blocked');
    expect((await call(claude.token, 'clear_blocker', { blocker_id: r.data.id, resolution: 'again' })).data.error.code).toBe('CONFLICT');
    expect((await getTaskDetail(owner, task.id)).history.map((h) => h.type)).toEqual(expect.arrayContaining(['blocker.reported', 'blocker.resolved']));
  });

  it('only the owning agent reports or clears; the owner can resolve; needs can name an agent', async () => {
    const { owner, claude, codex, task } = await setup();
    expect((await call(codex.token, 'report_blocker', { task_id: task.id, reason: 'r', question: 'q' })).data.error.code).toBe('CONFLICT');
    const r = await call(claude.token, 'report_blocker', { task_id: task.id, reason: 'Need schema', question: 'Which table?', needs: codex.agent.id });
    expect((await listBlockers(task.id))[0].needs).toBe('Codex');
    expect((await call(codex.token, 'clear_blocker', { blocker_id: r.data.id, resolution: 'x' })).data.error.code).toBe('CONFLICT');
    await resolveBlocker(owner, { blockerId: r.data.id, resolution: 'Answered on the task' });
    expect((await listBlockers(task.id))[0]).toMatchObject({ status: 'resolved', resolution: 'Answered on the task' });
  });
});
