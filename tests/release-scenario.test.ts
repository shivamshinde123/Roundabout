// Roundabout.md §8 / atlas diagram 17: the full first-release journey, end to end through
// the owner services and the real /api/mcp route for both agents.
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { tasks } from '@/server/db/schema';
import { listActivity } from '@/server/activity';
import { authenticateAgent, createAgentConnection, revokeAgent } from '@/server/agents';
import { listHandoffs } from '@/server/handoffs';
import { listInbox } from '@/server/inbox';
import { createBoard, createProject } from '@/server/projects';
import { reassignTask } from '@/server/recovery';
import { approveResult, listResults, requestChanges } from '@/server/results';
import { createTask, getTaskDetail, listBoardTasks } from '@/server/tasks';
import { ensureWorkspace } from '@/server/workspace';
import { call } from './mcp-client';
import { createUser } from './helpers';

const row = async (id: string) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0];
const kinds = async (owner: Parameters<typeof listInbox>[0], projectId: string) =>
  (await listInbox(owner, [projectId])).map((i) => `${i.kind}:${i.task.title}`);

describe('first-release acceptance scenario (§8)', () => {
  it('runs the whole journey with Claude Code and Codex', async () => {
    // 1. Sign in, create a project, add a second board, connect both agents.
    const owner = await ensureWorkspace((await createUser()).id);
    const { project, board } = await createProject(owner, { name: 'Website' });
    const design = await createBoard(owner, { projectId: project.id, name: 'Design' });
    // 2. Both agents get the test project; a second project stays restricted.
    const restricted = await createProject(owner, { name: 'Restricted' });
    const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [project.id] });
    const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [project.id] });
    expect((await call(claude.token, 'whoami')).data.projects.map((p: { name: string }) => p.name)).toEqual(['Website']);

    // 3. A review-required task assigned to Claude Code waits until it checks for work.
    const task = await createTask(owner, {
      boardId: board.id, title: 'Orders API', status: 'todo', assigneeAgentId: claude.agent.id,
      instructions: 'Wire the frontend to /api/orders', expectedResult: 'PR with tests', repository: 'acme/web',
    });
    expect((await listBoardTasks(owner, board.id))[0].badges).toEqual(['waiting_for_pickup']);
    expect((await row(task.id)).status).toBe('todo');

    // 4. Claude accepts, posts progress, and hands off to Codex with context.
    const waiting = await call(claude.token, 'list_assignments');
    expect(waiting.data.waiting.map((t: { id: string }) => t.id)).toEqual([task.id]);
    await call(claude.token, 'accept_task', { task_id: task.id, request_id: 'claim-1' });
    await call(claude.token, 'post_update', { task_id: task.id, body: 'Scaffolded the client', next_action: 'Add auth header' });
    const agents = await call(claude.token, 'list_agents', { project_id: project.id });
    const codexId = agents.data.agents.find((a: { name: string }) => a.name === 'Codex').id;
    const offer = await call(claude.token, 'propose_handoff', {
      task_id: task.id, to_agent_id: codexId, reason: 'Codex owns the API layer', work_completed: 'Client scaffolded', next_action: 'Add auth header',
    });
    let card = (await listBoardTasks(owner, board.id))[0];
    expect(card).toMatchObject({ status: 'in_progress', assignee: { name: 'Claude Code' }, handoffTo: 'Codex' });
    expect(card.badges).toContain('handoff_pending');

    // 5. Codex (opened later) accepts the handoff, submits; the task enters Review and Needs your input.
    const offered = await call(codex.token, 'list_assignments');
    expect(offered.data.handoffs_to_me[0].id).toBe(offer.data.id);
    await call(codex.token, 'respond_to_handoff', { handoff_id: offer.data.id, decision: 'accept' });
    expect((await row(task.id)).assigneeAgentId).toBe(codex.agent.id);
    const s1 = await call(codex.token, 'submit_result', { task_id: task.id, summary: 'PR #14 opened', links: [{ url: 'https://example.com/pr/14' }] });
    expect((await row(task.id)).status).toBe('review');
    expect(await kinds(owner, project.id)).toEqual(['review:Orders API']);

    // 6. Request changes once, then approve the revision → Done.
    await requestChanges(owner, { resultId: s1.data.result.id, expectedRevision: (await row(task.id)).revision, comment: 'Add tests' });
    expect((await row(task.id)).status).toBe('in_progress');
    const s2 = await call(codex.token, 'submit_result', { task_id: task.id, summary: 'PR #14 with tests' });
    await approveResult(owner, { resultId: s2.data.result.id, expectedRevision: (await row(task.id)).revision });
    expect((await row(task.id)).status).toBe('done');
    expect((await listResults(task.id)).map((r) => r.reviewStatus)).toEqual(['approved', 'changes_requested']);
    card = (await listBoardTasks(owner, board.id))[0];
    expect(card.completedBy).toBe('you');

    //    A separate task with review off is completed directly by the agent.
    const quick = await createTask(owner, { boardId: design.id, title: 'Fix typo', status: 'todo', assigneeAgentId: claude.agent.id, requireReview: false });
    await call(claude.token, 'accept_task', { task_id: quick.id });
    await call(claude.token, 'submit_result', { task_id: quick.id, summary: 'Fixed' });
    expect(await row(quick.id)).toMatchObject({ status: 'done' });
    expect((await listBoardTasks(owner, design.id))[0].completedBy).toBe('Claude Code');

    // 7. Blocker reported and resolved; interrupted work reassigned; simultaneous claims.
    const blocked = await createTask(owner, { boardId: board.id, title: 'Search', status: 'todo', assigneeAgentId: claude.agent.id });
    await call(claude.token, 'accept_task', { task_id: blocked.id });
    const b = await call(claude.token, 'report_blocker', { task_id: blocked.id, reason: 'No repo access', question: 'Add me to acme/api?', missing_resource: 'acme/api write' });
    expect(await kinds(owner, project.id)).toEqual(['blocked:Search']);
    await call(claude.token, 'clear_blocker', { blocker_id: b.data.id, resolution: 'Access granted' });
    expect(await kinds(owner, project.id)).toEqual([]);

    await reassignTask(owner, { taskId: blocked.id, expectedRevision: (await row(blocked.id)).revision, agentId: codex.agent.id });
    expect((await call(claude.token, 'post_update', { task_id: blocked.id, body: 'stale' })).data.error.code).toBe('CONFLICT');
    const race = await Promise.all([
      call(codex.token, 'accept_task', { task_id: blocked.id, request_id: 'race-a' }),
      call(codex.token, 'accept_task', { task_id: blocked.id, request_id: 'race-b' }),
      call(claude.token, 'accept_task', { task_id: blocked.id }),
    ]);
    expect(race.filter((r) => !r.isError)).toHaveLength(1);
    expect((await row(blocked.id)).assigneeAgentId).toBe(codex.agent.id);

    // 8. Cross-project denial and revocation; the other agent keeps working and history survives.
    const secret = await createTask(owner, { boardId: restricted.board.id, title: 'Secret' });
    expect((await call(claude.token, 'get_task', { task_id: secret.id })).data.error.code).toBe('NOT_FOUND');
    expect((await call(claude.token, 'create_task', { board_id: restricted.board.id, title: 'x' })).data.error.code).toBe('NOT_FOUND');

    await revokeAgent(owner, { agentId: claude.agent.id });
    await expect(authenticateAgent(`Bearer ${claude.token}`)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect((await call(codex.token, 'post_update', { task_id: blocked.id, body: 'Still going' })).isError).toBe(false);

    const history = (await getTaskDetail(owner, task.id)).history;
    expect(history.some((h) => h.actorName === 'Claude Code' && h.type === 'task.accepted')).toBe(true);
    expect((await listHandoffs(task.id))[0]).toMatchObject({ status: 'accepted', from: { name: 'Claude Code' }, to: { name: 'Codex' } });
    const activity = await listActivity(owner, project.id, { handoffsOnly: true });
    expect(activity.map((e) => e.type)).toEqual(['handoff.accepted', 'handoff.proposed']);
  });
});
