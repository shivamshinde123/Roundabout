import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { activityEvents, agentConnections, agentProjectGrants, tasks } from '@/server/db/schema';
import { createBoard, createProject } from '@/server/projects';
import {
  assignTask, createTask, deriveBadges, getTaskDetail, listAssignableAgents, listBoardTasks,
  moveTaskBoard, moveTaskStatus, updateTask,
} from '@/server/tasks';
import { seedAgent, seedOwner } from './helpers';

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.code);

async function setup() {
  const owner = await seedOwner();
  const { project, board } = await createProject(owner, { name: 'P' });
  const agent = await seedAgent(owner, [project.id], 'Claude Code');
  return { owner, project, board, agent };
}

describe('deriveBadges', () => {
  const base = { status: 'todo' as const, assignee: null, assigneeHasAccess: true, blocked: false, handoffPending: false, stale: false };
  it('waiting for pickup only when assigned in To Do', () => {
    expect(deriveBadges({ ...base, assignee: { status: 'active' } })).toEqual(['waiting_for_pickup']);
    expect(deriveBadges(base)).toEqual([]);
    expect(deriveBadges({ ...base, status: 'backlog', assignee: { status: 'active' } })).toEqual([]);
  });
  it('stalled after inactivity, but never when blocked (D-11)', () => {
    const inProgress = { ...base, status: 'in_progress' as const, assignee: { status: 'active' }, stale: true };
    expect(deriveBadges(inProgress)).toEqual(['stalled']);
    expect(deriveBadges({ ...inProgress, blocked: true })).toEqual(['blocked']);
    expect(deriveBadges({ ...base, status: 'backlog', stale: true })).toEqual([]);
  });
  it("agent can't access when revoked or ungranted, except once done", () => {
    const t = { ...base, status: 'in_progress' as const, assignee: { status: 'revoked' } };
    expect(deriveBadges(t)).toContain('agent_no_access');
    expect(deriveBadges({ ...t, assignee: { status: 'active' }, assigneeHasAccess: false })).toContain('agent_no_access');
    expect(deriveBadges({ ...t, status: 'done' })).toEqual([]);
  });
});

describe('tasks', () => {
  it('creates a task with defaults, an event, and shows it on the board', async () => {
    const { owner, board } = await setup();
    const task = await createTask(owner, {
      boardId: board.id, title: ' Fix login ', links: [{ label: 'Ticket', url: 'https://example.com/1' }], repository: 'acme/web',
    });
    expect(task).toMatchObject({ title: 'Fix login', status: 'backlog', requireReview: true, revision: 1, repository: 'acme/web', branch: null });
    const cards = await listBoardTasks(owner, board.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ title: 'Fix login', badges: [], assignee: null, latestResult: null });
    const detail = await getTaskDetail(owner, task.id);
    expect(detail.history.map((h) => h.type)).toEqual(['task.created']);
    expect(detail.history[0].actorName).toBe('You');
  });

  it('rejects bad links and empty titles', async () => {
    const { owner, board } = await setup();
    expect(await codeOf(createTask(owner, { boardId: board.id, title: '' }))).toBe('VALIDATION');
    expect(await codeOf(createTask(owner, { boardId: board.id, title: 'x', links: [{ url: 'javascript:alert(1)' }] }))).toBe('VALIDATION');
  });

  it('assigning shows Waiting for pickup in To Do; assignee needs project access', async () => {
    const { owner, project, board, agent } = await setup();
    const other = await createProject(owner, { name: 'Other' });
    const outsider = await seedAgent(owner, [other.project.id], 'Codex');
    const task = await createTask(owner, { boardId: board.id, title: 'T', status: 'todo' });

    expect(await codeOf(assignTask(owner, { taskId: task.id, expectedRevision: 1, agentId: outsider.agentId }))).toBe('VALIDATION');
    await assignTask(owner, { taskId: task.id, expectedRevision: 1, agentId: agent.agentId });
    const [card] = await listBoardTasks(owner, board.id);
    expect(card.assignee?.name).toBe('Claude Code');
    expect(card.badges).toEqual(['waiting_for_pickup']);
    expect((await listAssignableAgents(owner, project.id)).map((a) => a.name)).toEqual(['Claude Code']);

    // Revoked agents can't be assigned and aren't offered.
    await db.update(agentConnections).set({ status: 'revoked' }).where(eq(agentConnections.id, agent.agentId));
    const t2 = await createTask(owner, { boardId: board.id, title: 'T2' });
    expect(await codeOf(assignTask(owner, { taskId: t2.id, expectedRevision: 1, agentId: agent.agentId }))).toBe('VALIDATION');
    expect(await listAssignableAgents(owner, project.id)).toEqual([]);
    const [revokedCard] = await listBoardTasks(owner, board.id);
    expect(revokedCard.badges).toContain('agent_no_access');
  });

  it("flags an assignee that lost project access as can't access", async () => {
    const { owner, project, board, agent } = await setup();
    const task = await createTask(owner, { boardId: board.id, title: 'T', status: 'todo', assigneeAgentId: agent.agentId });
    await db.delete(agentProjectGrants).where(eq(agentProjectGrants.projectId, project.id));
    const card = (await listBoardTasks(owner, board.id)).find((c) => c.id === task.id)!;
    expect(card.badges).toEqual(['waiting_for_pickup', 'agent_no_access']);
  });

  it('only allows Backlog ↔ To Do moves from the board', async () => {
    const { owner, board } = await setup();
    const task = await createTask(owner, { boardId: board.id, title: 'T' });
    const moved = await moveTaskStatus(owner, { taskId: task.id, expectedRevision: 1, to: 'todo' });
    expect(moved).toMatchObject({ status: 'todo', revision: 2 });
    expect(await codeOf(moveTaskStatus(owner, { taskId: task.id, expectedRevision: 2, to: 'in_progress' }))).toBe('VALIDATION');
    await db.update(tasks).set({ status: 'in_progress' }).where(eq(tasks.id, task.id));
    expect(await codeOf(moveTaskStatus(owner, { taskId: task.id, expectedRevision: 2, to: 'backlog' }))).toBe('INVALID_STATE');
  });

  it('a stale revision gives CONFLICT and changes nothing', async () => {
    const { owner, board } = await setup();
    const task = await createTask(owner, { boardId: board.id, title: 'T' });
    await updateTask(owner, { taskId: task.id, expectedRevision: 1, title: 'New' });
    const err = await updateTask(owner, { taskId: task.id, expectedRevision: 1, title: 'Lost' }).catch((e) => e);
    expect(err.code).toBe('CONFLICT');
    expect(err.details.task.revision).toBe(2);
    expect((await getTaskDetail(owner, task.id)).title).toBe('New');
  });

  it('edits keep absent fields and record which fields changed', async () => {
    const { owner, board } = await setup();
    const task = await createTask(owner, { boardId: board.id, title: 'T', repository: 'acme/web', branch: 'main' });
    await updateTask(owner, { taskId: task.id, expectedRevision: 1, instructions: 'Do it', requireReview: false });
    const after = await getTaskDetail(owner, task.id);
    expect(after).toMatchObject({ repository: 'acme/web', branch: 'main', instructions: 'Do it', requireReview: false });
    expect(after.history[0].data).toEqual({ fields: ['instructions', 'requireReview'] });
    await updateTask(owner, { taskId: task.id, expectedRevision: 2, branch: '' });
    expect((await getTaskDetail(owner, task.id)).branch).toBeNull();
  });

  it('moves between boards of the same project only, keeping identity and history', async () => {
    const { owner, project, board } = await setup();
    const design = await createBoard(owner, { projectId: project.id, name: 'Design' });
    const other = await createProject(owner, { name: 'Other' });
    const task = await createTask(owner, { boardId: board.id, title: 'T' });
    expect(await codeOf(moveTaskBoard(owner, { taskId: task.id, expectedRevision: 1, boardId: other.board.id }))).toBe('VALIDATION');
    await moveTaskBoard(owner, { taskId: task.id, expectedRevision: 1, boardId: design.id });
    expect(await listBoardTasks(owner, board.id)).toHaveLength(0);
    const [moved] = await listBoardTasks(owner, design.id);
    expect(moved.id).toBe(task.id);
    expect((await getTaskDetail(owner, task.id)).history.map((h) => h.type)).toEqual(['task.moved_board', 'task.created']);
  });

  it('agents can create tasks in granted projects, always with review on, and never manage the board', async () => {
    const { owner, board, agent } = await setup();
    const task = await createTask(agent, { boardId: board.id, title: 'Follow-up', requireReview: false });
    expect(task.requireReview).toBe(true);
    const [created] = await db.select().from(activityEvents).where(eq(activityEvents.taskId, task.id));
    expect(created.actorId).toBe(agent.actorId);
    expect(await codeOf(updateTask(agent, { taskId: task.id, expectedRevision: 1, title: 'x' }))).toBe('FORBIDDEN');
    const outsider = await seedAgent(owner, []);
    expect(await codeOf(createTask(outsider, { boardId: board.id, title: 'x' }))).toBe('NOT_FOUND');
  });

  it("hides other workspaces' tasks", async () => {
    const { owner, board } = await setup();
    const task = await createTask(owner, { boardId: board.id, title: 'T' });
    const intruder = await seedOwner();
    expect(await codeOf(getTaskDetail(intruder, task.id))).toBe('NOT_FOUND');
    expect(await codeOf(listBoardTasks(intruder, board.id))).toBe('NOT_FOUND');
    expect(await codeOf(updateTask(intruder, { taskId: task.id, expectedRevision: 1, title: 'x' }))).toBe('NOT_FOUND');
    expect(await codeOf(getTaskDetail(owner, 'not-a-uuid'))).toBe('NOT_FOUND');
  });
});
