import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { activityEvents, boards, handoffs, projects, taskResults, tasks } from '@/server/db/schema';
import { createAgentConnection, deleteAgent, getAgentProfile, listAgents } from '@/server/agents';
import { createBoard, createProject, deleteBoard, deleteProject } from '@/server/projects';
import { createTask, deleteTask, getTaskDetail, listBoardTasks } from '@/server/tasks';
import { listActivity } from '@/server/activity';
import { call, rpc } from './mcp-client';
import { seedOwner } from './helpers';

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.code);

/** A project with real coordination data: accepted, handed off, result submitted. */
async function setup() {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'Website' });
  const claude = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
  const codex = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [a.project.id] });
  const task = await createTask(owner, { boardId: a.board.id, title: 'API wiring', status: 'todo', assigneeAgentId: claude.agent.id });
  await call(claude.token, 'accept_task', { task_id: task.id });
  await call(claude.token, 'propose_handoff', {
    task_id: task.id, to_agent_id: codex.agent.id, reason: 'r', work_completed: 'w', next_action: 'n',
  });
  return { owner, a, claude, codex, task };
}

describe('deleting what the owner created (D-28)', () => {
  it('deletes a task with its children and history, leaving one deleted event', async () => {
    const { owner, a, claude, task } = await setup();
    await deleteTask(owner, { taskId: task.id });
    expect(await db.select().from(tasks).where(eq(tasks.id, task.id))).toEqual([]);
    expect(await db.select().from(handoffs).where(eq(handoffs.taskId, task.id))).toEqual([]);
    expect(await db.select().from(activityEvents).where(eq(activityEvents.taskId, task.id))).toEqual([]);
    const feed = await listActivity(owner, a.project.id, {});
    expect(feed[0]).toMatchObject({ type: 'task.deleted', data: { title: 'API wiring' } });
    // The agent that worked on it now gets NOT_FOUND, like any task it can't see.
    expect((await call(claude.token, 'get_task', { task_id: task.id })).data.error.code).toBe('NOT_FOUND');
  });

  it('only the owner can delete, and only their own things', async () => {
    const { a, task } = await setup();
    const stranger = await seedOwner();
    expect(await codeOf(deleteTask(stranger, { taskId: task.id }))).toBe('NOT_FOUND');
    expect(await codeOf(deleteBoard(stranger, { boardId: a.board.id }))).toBe('NOT_FOUND');
    expect(await codeOf(deleteProject(stranger, { projectId: a.project.id }))).toBe('NOT_FOUND');
  });

  it('deletes a board and its tasks, but never the last board', async () => {
    const { owner, a, task } = await setup();
    expect(await codeOf(deleteBoard(owner, { boardId: a.board.id }))).toBe('INVALID_STATE');
    const other = await createBoard(owner, { projectId: a.project.id, name: 'Later' });
    const keep = await createTask(owner, { boardId: other.id, title: 'Keep me' });
    await deleteBoard(owner, { boardId: a.board.id });
    expect(await db.select().from(boards).where(eq(boards.id, a.board.id))).toEqual([]);
    expect(await codeOf(getTaskDetail(owner, task.id))).toBe('NOT_FOUND');
    expect((await listBoardTasks(owner, other.id)).map((t) => t.id)).toEqual([keep.id]);
    const feed = await listActivity(owner, a.project.id, {});
    expect(feed[0]).toMatchObject({ type: 'board.deleted', data: { name: 'Main', tasks: 1 } });
  });

  it('deletes a project with boards, tasks, grants and history; agents stay connected', async () => {
    const { owner, a, claude } = await setup();
    await deleteProject(owner, { projectId: a.project.id });
    expect(await db.select().from(projects).where(eq(projects.id, a.project.id))).toEqual([]);
    expect(await db.select().from(activityEvents).where(eq(activityEvents.projectId, a.project.id))).toEqual([]);
    const who = await call(claude.token, 'whoami', {});
    expect(who.data).toMatchObject({ projects: [] });
  });

  it('deleting an agent disconnects and hides it, keeping its past work attributed', async () => {
    const { owner, a, codex, task } = await setup();
    await call(codex.token, 'respond_to_handoff', { handoff_id: (await db.select().from(handoffs).where(eq(handoffs.taskId, task.id)))[0].id, decision: 'accept' });
    await call(codex.token, 'submit_result', { task_id: task.id, summary: 'Done' });

    await deleteAgent(owner, { agentId: codex.agent.id });
    expect((await listAgents(owner)).map((x) => x.name)).toEqual(['Claude Code']);
    expect(await codeOf(getAgentProfile(owner, codex.agent.id))).toBe('NOT_FOUND');
    expect(await codeOf(deleteAgent(owner, { agentId: codex.agent.id }))).toBe('NOT_FOUND');
    expect((await rpc(codex.token, 'tools/call', { name: 'whoami', arguments: {} })).status).toBe(401);
    const [result] = await db.select().from(taskResults).where(eq(taskResults.taskId, task.id));
    expect(result.submittedByAgentId).toBe(codex.agent.id);
    const card = (await listBoardTasks(owner, a.board.id)).find((t) => t.id === task.id)!;
    expect(card.assignee?.name).toBe('Codex');

    // The name is free again for a new connection.
    await expect(createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [] })).resolves.toBeTruthy();
  });
});
