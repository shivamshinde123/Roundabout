import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { tasks } from '@/server/db/schema';
import { listActivity, stageCounts } from '@/server/activity';
import { createAgentConnection, revokeAgent } from '@/server/agents';
import { inboxCounts, listInbox } from '@/server/inbox';
import { postMessage } from '@/server/messages';
import { createProject } from '@/server/projects';
import { approveResult } from '@/server/results';
import { createTask } from '@/server/tasks';
import { call } from './mcp-client';
import { seedOwner } from './helpers';

async function setup() {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'Website' });
  const b = await createProject(owner, { name: 'Docs' });
  const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id, b.project.id] });
  const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });
  const mk = async (title: string, agent = claude, board = a.board.id) => {
    const t = await createTask(owner, { boardId: board, title, status: 'todo', assigneeAgentId: agent.agent.id });
    await call(agent.token, 'accept_task', { task_id: t.id });
    return t;
  };
  return { owner, a, b, claude, codex, mk };
}

describe('needs your input', () => {
  it('collects reviews, blockers, questions, no-access and stalled work, and drops them once resolved', async () => {
    const { owner, a, b, claude, codex, mk } = await setup();
    const review = await mk('Hero section');
    const s = await call(claude.token, 'submit_result', { task_id: review.id, summary: 'PR #14' });
    const blocked = await mk('API wiring');
    await call(claude.token, 'report_blocker', { task_id: blocked.id, reason: 'No access', question: 'Add me?' });
    const asked = await mk('Footer');
    const q = await call(claude.token, 'post_message', { task_id: asked.id, to: 'owner', kind: 'question', body: 'Keep old URLs?' });
    await mk('Search', codex);
    await revokeAgent(owner, { agentId: codex.agent.id });
    const idle = await mk('Login bug');
    await db.update(tasks).set({ lastActivityAt: sql`now() - interval '30 hours'` }).where(eq(tasks.id, idle.id));
    await mk('Other project task', claude, b.board.id);

    const items = await listInbox(owner, [a.project.id]);
    expect(items.map((i) => [i.kind, i.task.title])).toEqual([
      ['review', 'Hero section'],
      ['blocked', 'API wiring'],
      ['question', 'Footer'],
      ['no_access', 'Search'],
      ['stalled', 'Login bug'],
    ]);
    expect(await inboxCounts(owner)).toEqual({ [a.project.id]: 5 });

    // Resolving removes items; the interaction stays on the task.
    await approveResult(owner, { resultId: s.data.result.id, expectedRevision: (await db.select().from(tasks).where(eq(tasks.id, review.id)))[0].revision });
    await postMessage(owner, { taskId: asked.id, replyTo: q.data.id, body: 'Yes' });
    const after = (await listInbox(owner, [a.project.id])).map((i) => i.kind);
    expect(after).toEqual(['blocked', 'no_access', 'stalled']);
  });

  it("only shows the owner's own workspace", async () => {
    const { owner, mk, claude } = await setup();
    const t = await mk('Mine');
    await call(claude.token, 'report_blocker', { task_id: t.id, reason: 'r', question: 'q' });
    expect(await listInbox(await seedOwner())).toEqual([]);
    expect((await listInbox(owner)).length).toBe(1);
  });
});

describe('activity', () => {
  it('lists project events newest first, filterable by agent and handoffs', async () => {
    const { owner, a, claude, codex, mk } = await setup();
    const t = await mk('Task');
    await call(claude.token, 'propose_handoff', { task_id: t.id, to_agent_id: codex.agent.id, reason: 'r', work_completed: 'w', next_action: 'n' });
    const all = await listActivity(owner, a.project.id);
    expect(all[0]).toMatchObject({ type: 'handoff.proposed', actor: { name: 'Claude Code' }, task: { title: 'Task' } });
    expect((await listActivity(owner, a.project.id, { handoffsOnly: true })).map((e) => e.type)).toEqual(['handoff.proposed']);
    const byClaude = await listActivity(owner, a.project.id, { agentId: claude.agent.id });
    expect(byClaude.every((e) => e.actor.name === 'Claude Code')).toBe(true);
    expect(byClaude.map((e) => e.type)).toEqual(expect.arrayContaining(['task.accepted', 'handoff.proposed']));
    expect(await listActivity(owner, a.project.id, { agentId: codex.agent.id })).toEqual([]);
    await expect(listActivity(await seedOwner(), a.project.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('counts tasks by stage across boards', async () => {
    const { owner, a, mk } = await setup();
    await mk('One');
    await createTask(owner, { boardId: a.board.id, title: 'Two' });
    expect(await stageCounts(owner, a.project.id)).toEqual({ backlog: 1, todo: 0, in_progress: 1, review: 0, done: 0 });
  });
});
