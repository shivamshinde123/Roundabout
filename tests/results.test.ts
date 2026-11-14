import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { tasks } from '@/server/db/schema';
import { createAgentConnection } from '@/server/agents';
import { listHandoffs } from '@/server/handoffs';
import { listMessages } from '@/server/messages';
import { createProject } from '@/server/projects';
import { approveResult, listResults, requestChanges } from '@/server/results';
import { createTask, getTaskDetail, listBoardTasks } from '@/server/tasks';
import { call } from './mcp-client';
import { seedOwner } from './helpers';

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.code);
const row = async (id: string) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0];

async function setup(requireReview = true) {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'Website' });
  const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
  const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });
  const task = await createTask(owner, { boardId: a.board.id, title: 'Hero section', status: 'todo', assigneeAgentId: claude.agent.id, requireReview });
  await call(claude.token, 'accept_task', { task_id: task.id });
  return { owner, a, claude, codex, task };
}

describe('submit, review and complete', () => {
  it('review on: submission goes to Review; changes requested keeps it; resubmit and approve → Done by the owner', async () => {
    const { owner, a, claude, task } = await setup(true);
    const s1 = await call(claude.token, 'submit_result', { task_id: task.id, summary: 'PR #14 opened', links: [{ url: 'https://example.com/pr/14' }] });
    expect(s1.data).toMatchObject({ result: { review_status: 'pending' }, task: { status: 'review' } });
    const [card] = await listBoardTasks(owner, a.board.id);
    expect(card).toMatchObject({ status: 'review', latestResult: 'PR #14 opened', pendingResultId: s1.data.result.id });

    // Agents can't approve; the owner requests changes.
    let t = await row(task.id);
    await requestChanges(owner, { resultId: s1.data.result.id, expectedRevision: t.revision, comment: 'Add mobile layout' });
    expect((await row(task.id)).status).toBe('in_progress');
    const msgs = await listMessages(task.id);
    expect(msgs.at(-1)).toMatchObject({ body: 'Changes requested: Add mobile layout', recipient: { name: 'Claude Code' } });

    const s2 = await call(claude.token, 'submit_result', { task_id: task.id, summary: 'PR #14 updated' });
    t = await row(task.id);
    await approveResult(owner, { resultId: s2.data.result.id, expectedRevision: t.revision });
    const done = await row(task.id);
    expect(done.status).toBe('done');
    expect(done.completedByActorId).toBe(owner.actorId);

    const results = await listResults(task.id);
    expect(results.map((r) => [r.summary, r.reviewStatus])).toEqual([['PR #14 updated', 'approved'], ['PR #14 opened', 'changes_requested']]);
    expect(results[1].reviewComment).toBe('Add mobile layout');
    const types = (await getTaskDetail(owner, task.id)).history.map((h) => h.type);
    expect(types).toEqual(expect.arrayContaining(['review.changes_requested', 'review.approved', 'task.completed']));
  });

  it('review off: the agent completes the task directly', async () => {
    const { claude, task } = await setup(false);
    const s = await call(claude.token, 'submit_result', { task_id: task.id, summary: 'Fixed' });
    expect(s.data).toMatchObject({ result: { review_status: 'not_required' }, task: { status: 'done' } });
    const done = await row(task.id);
    expect(done.completedByActorId).not.toBeNull();
    expect(done.completedAt).not.toBeNull();
  });

  it('only the owning agent submits; review needs the current revision and a pending submission', async () => {
    const { owner, claude, codex, task } = await setup(true);
    expect((await call(codex.token, 'submit_result', { task_id: task.id, summary: 'x' })).data.error.code).toBe('CONFLICT');
    expect((await call(claude.token, 'submit_result', { task_id: task.id, summary: ' ' })).data.error.code).toBe('VALIDATION');
    const s = await call(claude.token, 'submit_result', { task_id: task.id, summary: 'Done' });
    const t = await row(task.id);
    expect(await codeOf(approveResult(owner, { resultId: s.data.result.id, expectedRevision: t.revision - 1 }))).toBe('CONFLICT');
    expect(await codeOf(requestChanges(owner, { resultId: s.data.result.id, expectedRevision: t.revision, comment: ' ' }))).toBe('VALIDATION');
    await approveResult(owner, { resultId: s.data.result.id, expectedRevision: t.revision });
    const after = await row(task.id);
    expect(await codeOf(approveResult(owner, { resultId: s.data.result.id, expectedRevision: after.revision }))).toBe('CONFLICT');
    // Once in review the agent can no longer post updates as owner of in-progress work.
    expect((await call(claude.token, 'post_update', { task_id: task.id, body: 'late' })).data.error.code).toBe('CONFLICT');
  });

  it('submitting supersedes a pending handoff', async () => {
    const { claude, codex, task } = await setup(true);
    await call(claude.token, 'propose_handoff', { task_id: task.id, to_agent_id: codex.agent.id, reason: 'r', work_completed: 'w', next_action: 'n' });
    await call(claude.token, 'submit_result', { task_id: task.id, summary: 'Finished anyway' });
    expect((await listHandoffs(task.id))[0].status).toBe('superseded');
  });

  it('get_task shows submissions and review comments to the agent', async () => {
    const { owner, claude, task } = await setup(true);
    const s = await call(claude.token, 'submit_result', { task_id: task.id, summary: 'v1' });
    await requestChanges(owner, { resultId: s.data.result.id, expectedRevision: (await row(task.id)).revision, comment: 'Needs tests' });
    const detail = await call(claude.token, 'get_task', { task_id: task.id });
    expect(detail.data.results[0]).toMatchObject({ summary: 'v1', review_status: 'changes_requested', review_comment: 'Needs tests' });
    expect(detail.data.status).toBe('in_progress');
  });
});

describe('done cards', () => {
  it('show who approved or completed the task', async () => {
    const reviewed = await setup(true);
    const s = await call(reviewed.claude.token, 'submit_result', { task_id: reviewed.task.id, summary: 'ok' });
    await approveResult(reviewed.owner, { resultId: s.data.result.id, expectedRevision: (await row(reviewed.task.id)).revision });
    expect((await listBoardTasks(reviewed.owner, reviewed.a.board.id))[0].completedBy).toBe('you');

    const direct = await setup(false);
    await call(direct.claude.token, 'submit_result', { task_id: direct.task.id, summary: 'ok' });
    expect((await listBoardTasks(direct.owner, direct.a.board.id))[0].completedBy).toBe('Claude Code');
  });
});
