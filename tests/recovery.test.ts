import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { tasks } from '@/server/db/schema';
import { createAgentConnection, revokeAgent } from '@/server/agents';
import { listHandoffs } from '@/server/handoffs';
import { createProject } from '@/server/projects';
import { reassignTask, reopenTask } from '@/server/recovery';
import { listResults } from '@/server/results';
import { createTask, getTaskDetail, listBoardTasks } from '@/server/tasks';
import { call } from './mcp-client';
import { seedOwner } from './helpers';

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.code);
const row = async (id: string) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0];

async function setup() {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'Website' });
  const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
  const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });
  const task = await createTask(owner, { boardId: a.board.id, title: 'Search page', status: 'todo', assigneeAgentId: claude.agent.id });
  await call(claude.token, 'accept_task', { task_id: task.id });
  return { owner, a, claude, codex, task };
}

describe('reassign', () => {
  it('moves stuck work to another agent; the old agent can no longer write; pickup starts again', async () => {
    const { owner, claude, codex, task } = await setup();
    await call(claude.token, 'post_update', { task_id: task.id, body: 'Halfway', next_action: 'Finish filters' });
    await call(claude.token, 'propose_handoff', { task_id: task.id, to_agent_id: codex.agent.id, reason: 'r', work_completed: 'w', next_action: 'n' });

    await reassignTask(owner, { taskId: task.id, expectedRevision: (await row(task.id)).revision, agentId: codex.agent.id });
    const t = await row(task.id);
    expect(t).toMatchObject({ status: 'todo', assigneeAgentId: codex.agent.id, nextAction: null });
    expect((await listHandoffs(task.id))[0].status).toBe('superseded');

    // Stale owner is rejected everywhere it could overwrite work.
    for (const [tool, args] of [
      ['post_update', { task_id: task.id, body: 'late' }],
      ['submit_result', { task_id: task.id, summary: 'late' }],
      ['report_blocker', { task_id: task.id, reason: 'r', question: 'q' }],
    ] as const) {
      expect((await call(claude.token, tool, args)).data.error.code).toBe('CONFLICT');
    }
    // Earlier messages and history are kept; the new agent picks it up normally.
    const detail = await getTaskDetail(owner, task.id);
    expect(detail.history.map((h) => h.type)).toEqual(expect.arrayContaining(['task.reassigned', 'handoff.superseded', 'message.posted']));
    expect((await call(codex.token, 'accept_task', { task_id: task.id })).isError).toBe(false);
  });

  it('supersedes a pending review, can unassign to Backlog, and needs current state', async () => {
    const { owner, claude, task } = await setup();
    const s = await call(claude.token, 'submit_result', { task_id: task.id, summary: 'v1' });
    const t = await row(task.id);
    expect(await codeOf(reassignTask(owner, { taskId: task.id, expectedRevision: t.revision - 1, agentId: null }))).toBe('CONFLICT');
    await reassignTask(owner, { taskId: task.id, expectedRevision: t.revision, agentId: null });
    expect(await row(task.id)).toMatchObject({ status: 'backlog', assigneeAgentId: null });
    expect((await listResults(task.id))[0]).toMatchObject({ id: s.data.result.id, reviewStatus: 'superseded' });
  });

  it('rejects reassigning to an agent without access, and reassigning Done work', async () => {
    const { owner, task } = await setup();
    const other = await createProject(owner, { name: 'Other' });
    const outsider = await createAgentConnection(owner, { name: 'Outsider', client: 'other', projectIds: [other.project.id] });
    const t = await row(task.id);
    expect(await codeOf(reassignTask(owner, { taskId: task.id, expectedRevision: t.revision, agentId: outsider.agent.id }))).toBe('VALIDATION');
    await db.update(tasks).set({ status: 'done' }).where(eq(tasks.id, task.id));
    expect(await codeOf(reassignTask(owner, { taskId: task.id, expectedRevision: t.revision, agentId: null }))).toBe('INVALID_STATE');
  });
});

describe('reopen', () => {
  it('reopens Done work to the same agent, keeping results and history', async () => {
    const { owner, claude, task } = await setup();
    await db.update(tasks).set({ requireReview: false }).where(eq(tasks.id, task.id));
    await call(claude.token, 'submit_result', { task_id: task.id, summary: 'Shipped' });
    const done = await row(task.id);
    expect(done.status).toBe('done');
    expect(await codeOf(reopenTask(owner, { taskId: task.id, expectedRevision: done.revision - 1 }))).toBe('CONFLICT');

    await reopenTask(owner, { taskId: task.id, expectedRevision: done.revision });
    expect(await row(task.id)).toMatchObject({ status: 'todo', assigneeAgentId: claude.agent.id, completedAt: null, completedByActorId: null });
    expect((await listResults(task.id))[0].summary).toBe('Shipped');
    expect((await getTaskDetail(owner, task.id)).history[0].type).toBe('task.reopened');
    expect(await codeOf(reopenTask(owner, { taskId: task.id, expectedRevision: (await row(task.id)).revision }))).toBe('INVALID_STATE');
  });

  it('reopens to Backlog when the previous agent was disconnected', async () => {
    const { owner, claude, task } = await setup();
    await db.update(tasks).set({ requireReview: false }).where(eq(tasks.id, task.id));
    await call(claude.token, 'submit_result', { task_id: task.id, summary: 'Shipped' });
    await revokeAgent(owner, { agentId: claude.agent.id });
    await reopenTask(owner, { taskId: task.id, expectedRevision: (await row(task.id)).revision });
    expect(await row(task.id)).toMatchObject({ status: 'backlog', assigneeAgentId: null });
  });
});

describe('stalled and no-access badges on real data', () => {
  it('flags work idle for 24h, and never blocked work', async () => {
    const { owner, a, claude, task } = await setup();
    await db.update(tasks).set({ lastActivityAt: sql`now() - interval '25 hours'` }).where(eq(tasks.id, task.id));
    expect((await listBoardTasks(owner, a.board.id))[0].badges).toEqual(['stalled']);

    await call(claude.token, 'report_blocker', { task_id: task.id, reason: 'r', question: 'q' });
    await db.update(tasks).set({ lastActivityAt: sql`now() - interval '25 hours'` }).where(eq(tasks.id, task.id));
    expect((await listBoardTasks(owner, a.board.id))[0].badges).toEqual(['blocked']);
  });

  it("marks a disconnected agent's unfinished work so the owner can reassign it", async () => {
    const { owner, a, claude, codex, task } = await setup();
    await revokeAgent(owner, { agentId: claude.agent.id });
    expect((await listBoardTasks(owner, a.board.id))[0].badges).toContain('agent_no_access');
    await reassignTask(owner, { taskId: task.id, expectedRevision: (await row(task.id)).revision, agentId: codex.agent.id });
    expect((await listBoardTasks(owner, a.board.id))[0].badges).toEqual(['waiting_for_pickup']);
  });
});
