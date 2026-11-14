import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { GET } from '@/app/api/mcp/route';
import { call, rpc } from './mcp-client';
import { db } from '@/server/db/client';
import { agentConnections, taskMessages, tasks } from '@/server/db/schema';
import { createAgentConnection } from '@/server/agents';
import { listMessages, postMessage } from '@/server/messages';
import { createProject } from '@/server/projects';
import { createTask } from '@/server/tasks';
import { seedOwner } from './helpers';

async function setup() {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'Website' });
  const b = await createProject(owner, { name: 'Secret' });
  const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
  const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });
  return { owner, a, b, claude, codex };
}

describe('MCP endpoint', () => {
  it('rejects missing or bad tokens with 401, and GET with 405', async () => {
    expect((await rpc(null, 'tools/list')).status).toBe(401);
    expect((await rpc('rbt_nope', 'tools/list')).status).toBe(401);
    expect((await GET()).status).toBe(405);
  });

  it('initializes, lists tools, and whoami activates the connection with its projects', async () => {
    const { a, claude } = await setup();
    const init = await rpc(claude.token, 'initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' },
    });
    expect(init.body.result.serverInfo.name).toBe('roundabout');
    const tools = (await rpc(claude.token, 'tools/list')).body.result.tools.map((t: { name: string }) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['whoami', 'list_assignments', 'get_task', 'list_agents', 'accept_task', 'post_update', 'post_message', 'create_task']));

    const me = await call(claude.token, 'whoami');
    expect(me.data.agent.name).toBe('Claude Code');
    expect(me.data.projects.map((p: { name: string }) => p.name)).toEqual(['Website']);
    expect(me.data.projects[0].boards[0]).toMatchObject({ name: 'Main', id: a.board.id });
    const [row] = await db.select().from(agentConnections).where(eq(agentConnections.id, claude.agent.id));
    expect(row.status).toBe('active');
  });

  it('pickup: waiting task appears, accepting moves it to In Progress exactly once', async () => {
    const { owner, a, claude, codex } = await setup();
    const task = await createTask(owner, { boardId: a.board.id, title: 'Fix login', status: 'todo', assigneeAgentId: claude.agent.id });

    const before = await call(claude.token, 'list_assignments');
    expect(before.data.waiting.map((t: { id: string }) => t.id)).toEqual([task.id]);
    expect(before.data.waiting[0]).toMatchObject({ badges: ['waiting_for_pickup'], project: { name: 'Website' } });

    // Not the assignee: conflict, nothing changes.
    expect((await call(codex.token, 'accept_task', { task_id: task.id })).data.error.code).toBe('CONFLICT');

    // Two concurrent claims by the assignee (different request ids): exactly one wins.
    const results = await Promise.all([
      call(claude.token, 'accept_task', { task_id: task.id, request_id: 'r1' }),
      call(claude.token, 'accept_task', { task_id: task.id, request_id: 'r2' }),
    ]);
    expect(results.filter((r) => !r.isError)).toHaveLength(1);
    expect(results.find((r) => r.isError)!.data.error.code).toBe('CONFLICT');

    // Retrying the winning request id replays success instead of conflicting.
    const winner = results.find((r) => !r.isError)!;
    const winnerId = results[0].isError ? 'r2' : 'r1';
    const replay = await call(claude.token, 'accept_task', { task_id: task.id, request_id: winnerId });
    expect(replay.isError).toBe(false);
    expect(winner.data.status).toBe('in_progress');

    const [t] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(t.status).toBe('in_progress');
    const detail = await call(claude.token, 'get_task', { task_id: task.id });
    expect(detail.data.history.filter((h: { type: string }) => h.type === 'task.accepted')).toHaveLength(1);
  });

  it('cross-project access is NOT_FOUND and agent-created tasks always require review', async () => {
    const { owner, a, b, claude } = await setup();
    const secret = await createTask(owner, { boardId: b.board.id, title: 'Secret' });
    expect((await call(claude.token, 'get_task', { task_id: secret.id })).data.error.code).toBe('NOT_FOUND');
    expect((await call(claude.token, 'create_task', { board_id: b.board.id, title: 'x' })).data.error.code).toBe('NOT_FOUND');
    expect((await call(claude.token, 'list_agents', { project_id: b.project.id })).data.error.code).toBe('NOT_FOUND');

    const created = await call(claude.token, 'create_task', { board_id: a.board.id, title: 'Follow-up', require_review: false });
    expect(created.isError).toBe(false);
    expect(created.data.require_review).toBe(true);
  });

  it('updates come from the owning agent only and set the next action; retries do not duplicate', async () => {
    const { owner, a, claude, codex } = await setup();
    const task = await createTask(owner, { boardId: a.board.id, title: 'T', status: 'todo', assigneeAgentId: claude.agent.id });
    await call(claude.token, 'accept_task', { task_id: task.id });

    expect((await call(codex.token, 'post_update', { task_id: task.id, body: 'hi' })).data.error.code).toBe('CONFLICT');
    const args = { task_id: task.id, body: 'Scaffolded the client', next_action: 'Add auth header', request_id: 'u1' };
    const first = await call(claude.token, 'post_update', args);
    const again = await call(claude.token, 'post_update', args);
    expect(again.data).toEqual(first.data);
    expect(await db.select().from(taskMessages).where(eq(taskMessages.taskId, task.id))).toHaveLength(1);
    const [t] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(t.nextAction).toBe('Add auth header');
  });

  it("questions reach the owner; the owner's reply answers it and the agent sees it unread", async () => {
    const { owner, a, claude } = await setup();
    const task = await createTask(owner, { boardId: a.board.id, title: 'T', status: 'todo', assigneeAgentId: claude.agent.id });
    const q = await call(claude.token, 'post_message', { task_id: task.id, to: 'owner', kind: 'question', body: 'Keep old URLs?' });
    expect(q.isError).toBe(false);
    expect((await call(claude.token, 'post_message', { task_id: task.id, kind: 'question', body: 'no recipient' })).data.error.code).toBe('VALIDATION');

    await postMessage(owner, { taskId: task.id, replyTo: q.data.id, body: 'Yes, keep them.' });
    const msgs = await listMessages(task.id);
    expect(msgs[0].answeredAt).not.toBeNull();
    expect(msgs[1]).toMatchObject({ sender: { name: 'Owner' }, recipient: { name: 'Claude Code' } });

    const assignments = await call(claude.token, 'list_assignments');
    expect(assignments.data.unread_messages).toEqual([{ task_id: task.id, count: 1 }]);
    const detail = await call(claude.token, 'get_task', { task_id: task.id });
    expect(detail.data.messages.map((m: { body: string }) => m.body)).toEqual(['Keep old URLs?', 'Yes, keep them.']);
    expect((await call(claude.token, 'list_assignments')).data.unread_messages).toEqual([]);
  });

  it('list_agents shows other agents in the project for handoffs', async () => {
    const { a, claude } = await setup();
    const res = await call(claude.token, 'list_agents', { project_id: a.project.id });
    expect(res.data.agents.map((x: { name: string }) => x.name)).toEqual(['Codex']);
  });
});
