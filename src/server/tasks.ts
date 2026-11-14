import 'server-only';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, type Tx } from './db/client';
import { activityEvents, actors, agentConnections, agentProjectGrants, boards, projects, tasks } from './db/schema';
import { AppError, notFound } from './errors';
import { appendEvent } from './events';
import { assertOwner, assertProjectAccess, type Actor } from './policy';
import {
  assignTaskInput, createTaskInput, moveTaskBoardInput, moveTaskStatusInput, parse, updateTaskInput, uuid,
} from '@/lib/schemas';
import type { Link } from './db/schema';

/** D-4: flag waiting/handoff/in-progress work with no activity for this long. */
export const STALLED_AFTER_HOURS = 24;

export type TaskStatus = (typeof tasks.$inferSelect)['status'];
export type TaskBadge = 'waiting_for_pickup' | 'handoff_pending' | 'blocked' | 'stalled' | 'agent_no_access';
export type AgentRef = { id: string; name: string; client: string; status: string };

export type TaskCard = {
  id: string;
  projectId: string;
  boardId: string;
  title: string;
  status: TaskStatus;
  requireReview: boolean;
  assignee: AgentRef | null;
  nextAction: string | null;
  latestResult: string | null;
  handoffTo: string | null;
  badges: TaskBadge[];
  revision: number;
  lastActivityAt: Date;
};

/** Pure badge rules (database-schema.md "Derived states", D-2, D-4, D-11). */
export function deriveBadges(t: {
  status: TaskStatus;
  assignee: Pick<AgentRef, 'status'> | null;
  assigneeHasAccess: boolean;
  blocked: boolean;
  handoffPending: boolean;
  stale: boolean;
}): TaskBadge[] {
  const out: TaskBadge[] = [];
  const waiting = t.status === 'todo' && t.assignee !== null;
  if (waiting) out.push('waiting_for_pickup');
  if (t.handoffPending) out.push('handoff_pending');
  if (t.blocked) out.push('blocked');
  if (t.stale && !t.blocked && (waiting || t.handoffPending || t.status === 'in_progress')) out.push('stalled');
  if (t.status !== 'done' && t.assignee && (t.assignee.status === 'revoked' || !t.assigneeHasAccess)) out.push('agent_no_access');
  return out;
}

// ── Reads ────────────────────────────────────────────────────────────────────

const cardColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  boardId: tasks.boardId,
  title: tasks.title,
  status: tasks.status,
  requireReview: tasks.requireReview,
  nextAction: tasks.nextAction,
  revision: tasks.revision,
  lastActivityAt: tasks.lastActivityAt,
  assigneeId: agentConnections.id,
  assigneeName: agentConnections.name,
  assigneeClient: agentConnections.client,
  assigneeStatus: agentConnections.status,
  assigneeHasAccess: sql<boolean>`exists (select 1 from agent_project_grants g
    where g.agent_connection_id = "tasks"."assignee_agent_id" and g.project_id = "tasks"."project_id")`,
  blocked: sql<boolean>`exists (select 1 from blockers b where b.task_id = "tasks"."id" and b.status = 'open')`,
  handoffTo: sql<string | null>`(select ac.name from handoffs h join agent_connections ac on ac.id = h.to_agent_id
    where h.task_id = "tasks"."id" and h.status = 'pending')`,
  latestResult: sql<string | null>`(select r.summary from task_results r where r.task_id = "tasks"."id"
    order by r.created_at desc limit 1)`,
  stale: sql<boolean>`"tasks"."last_activity_at" < now() - make_interval(hours => ${STALLED_AFTER_HOURS})`,
};

type CardRow = { [K in keyof typeof cardColumns]: unknown } & Record<string, unknown>;

function toCard(r: CardRow): TaskCard {
  const assignee = r.assigneeId
    ? { id: r.assigneeId as string, name: r.assigneeName as string, client: r.assigneeClient as string, status: r.assigneeStatus as string }
    : null;
  return {
    id: r.id as string,
    projectId: r.projectId as string,
    boardId: r.boardId as string,
    title: r.title as string,
    status: r.status as TaskStatus,
    requireReview: r.requireReview as boolean,
    nextAction: r.nextAction as string | null,
    revision: r.revision as number,
    lastActivityAt: r.lastActivityAt as Date,
    assignee,
    latestResult: r.latestResult as string | null,
    handoffTo: r.handoffTo as string | null,
    badges: deriveBadges({
      status: r.status as TaskStatus,
      assignee,
      assigneeHasAccess: Boolean(r.assigneeHasAccess),
      blocked: Boolean(r.blocked),
      handoffPending: r.handoffTo !== null,
      stale: Boolean(r.stale),
    }),
  };
}

async function loadBoard(actor: Actor, boardId: string) {
  if (!uuid.safeParse(boardId).success) throw notFound('Board');
  const [board] = await db
    .select({ id: boards.id, projectId: boards.projectId, workspaceId: projects.workspaceId })
    .from(boards)
    .innerJoin(projects, eq(projects.id, boards.projectId))
    .where(eq(boards.id, boardId));
  if (!board) throw notFound('Board');
  assertProjectAccess(actor, board, 'Board');
  return board;
}

export async function listBoardTasks(actor: Actor, boardId: string): Promise<TaskCard[]> {
  await loadBoard(actor, boardId);
  const rows = await db
    .select(cardColumns)
    .from(tasks)
    .leftJoin(agentConnections, eq(agentConnections.id, tasks.assigneeAgentId))
    .where(eq(tasks.boardId, boardId))
    .orderBy(asc(tasks.createdAt));
  return rows.map(toCard);
}

export type TaskDetail = TaskCard & {
  instructions: string;
  expectedResult: string;
  links: Link[];
  repository: string | null;
  branch: string | null;
  createdAt: Date;
  history: { id: number; type: string; actorName: string; data: Record<string, unknown>; createdAt: Date }[];
};

/** Display name for an actor: agent connection name, or "You" for the owner. */
const actorName = sql<string>`coalesce((select ac.name from agent_connections ac where ac.id = "actors"."agent_connection_id"), 'You')`;

export async function getTaskDetail(actor: Actor, taskId: string): Promise<TaskDetail> {
  if (!uuid.safeParse(taskId).success) throw notFound('Task');
  const [row] = await db
    .select({
      ...cardColumns,
      workspaceId: projects.workspaceId,
      instructions: tasks.instructions,
      expectedResult: tasks.expectedResult,
      links: tasks.links,
      repository: tasks.repository,
      branch: tasks.branch,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(agentConnections, eq(agentConnections.id, tasks.assigneeAgentId))
    .where(eq(tasks.id, taskId));
  if (!row) throw notFound('Task');
  assertProjectAccess(actor, { workspaceId: row.workspaceId, projectId: row.projectId }, 'Task');

  const history = await db
    .select({ id: activityEvents.id, type: activityEvents.type, data: activityEvents.data, createdAt: activityEvents.createdAt, actorName })
    .from(activityEvents)
    .innerJoin(actors, eq(actors.id, activityEvents.actorId))
    .where(eq(activityEvents.taskId, taskId))
    .orderBy(desc(activityEvents.id))
    .limit(50);

  return {
    ...toCard(row),
    instructions: row.instructions,
    expectedResult: row.expectedResult,
    links: row.links,
    repository: row.repository,
    branch: row.branch,
    createdAt: row.createdAt,
    history,
  };
}

/** Agents the owner may assign in this project: not revoked, with a grant (D-11). */
export async function listAssignableAgents(actor: Actor, projectId: string): Promise<AgentRef[]> {
  return db
    .select({ id: agentConnections.id, name: agentConnections.name, client: agentConnections.client, status: agentConnections.status })
    .from(agentConnections)
    .innerJoin(agentProjectGrants, eq(agentProjectGrants.agentConnectionId, agentConnections.id))
    .where(and(
      eq(agentConnections.workspaceId, actor.workspaceId),
      eq(agentProjectGrants.projectId, projectId),
      sql`${agentConnections.status} <> 'revoked'`,
    ))
    .orderBy(asc(agentConnections.name));
}

// ── Write helpers (used by every task-changing service) ─────────────────────

export type LockedTask = typeof tasks.$inferSelect & { workspaceId: string };

/** SELECT … FOR UPDATE the task inside `tx`, then check the actor can see it. */
export async function lockTask(tx: Tx, actor: Actor, taskId: string): Promise<LockedTask> {
  if (!uuid.safeParse(taskId).success) throw notFound('Task');
  const [row] = await tx
    .select({ task: tasks, workspaceId: projects.workspaceId })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .for('update', { of: tasks });
  if (!row) throw notFound('Task');
  assertProjectAccess(actor, { workspaceId: row.workspaceId, projectId: row.task.projectId }, 'Task');
  return { ...row.task, workspaceId: row.workspaceId };
}

export function snapshot(t: LockedTask) {
  return { id: t.id, status: t.status, assigneeAgentId: t.assigneeAgentId, revision: t.revision };
}

export function assertRevision(t: LockedTask, expected: number) {
  if (t.revision !== expected) {
    throw new AppError('CONFLICT', 'This task changed since you opened it. Showing the latest.', { task: snapshot(t) });
  }
}

/** Apply a change, bumping revision and activity time (D-4). */
export async function touchTask(tx: Tx, taskId: string, patch: Partial<typeof tasks.$inferInsert>) {
  const [updated] = await tx
    .update(tasks)
    .set({ ...patch, revision: sql`${tasks.revision} + 1`, lastActivityAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}

/** The agent must exist in the workspace, not be revoked, and have a grant for the project. */
export async function assertAssignable(tx: Tx, workspaceId: string, projectId: string, agentId: string) {
  const [ok] = await tx
    .select({ id: agentConnections.id })
    .from(agentConnections)
    .innerJoin(agentProjectGrants, and(
      eq(agentProjectGrants.agentConnectionId, agentConnections.id),
      eq(agentProjectGrants.projectId, projectId),
    ))
    .where(and(
      eq(agentConnections.id, agentId),
      eq(agentConnections.workspaceId, workspaceId),
      sql`${agentConnections.status} <> 'revoked'`,
    ));
  if (!ok) throw new AppError('VALIDATION', 'That agent is disconnected or has no access to this project.');
}

// ── Owner and agent writes ──────────────────────────────────────────────────

export async function createTask(actor: Actor, input: unknown) {
  const data = parse(createTaskInput, input);
  return db.transaction(async (tx) => {
    const [board] = await tx
      .select({ id: boards.id, projectId: boards.projectId, workspaceId: projects.workspaceId })
      .from(boards)
      .innerJoin(projects, eq(projects.id, boards.projectId))
      .where(eq(boards.id, data.boardId));
    if (!board) throw notFound('Board');
    assertProjectAccess(actor, board, 'Board');
    if (data.assigneeAgentId) await assertAssignable(tx, board.workspaceId, board.projectId, data.assigneeAgentId);

    const [task] = await tx
      .insert(tasks)
      .values({
        projectId: board.projectId,
        boardId: board.id,
        title: data.title,
        instructions: data.instructions,
        expectedResult: data.expectedResult,
        links: data.links,
        repository: data.repository,
        branch: data.branch,
        status: data.status,
        assigneeAgentId: data.assigneeAgentId ?? null,
        // D-11: only the owner may turn review off.
        requireReview: actor.kind === 'human' ? data.requireReview : true,
        createdByActorId: actor.actorId,
      })
      .returning();
    const scope = { projectId: task.projectId, taskId: task.id };
    await appendEvent(tx, actor, 'task.created', scope, { title: task.title, status: task.status });
    if (task.assigneeAgentId) await appendEvent(tx, actor, 'task.assigned', scope, { toAgentId: task.assigneeAgentId });
    return task;
  });
}

export async function updateTask(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { taskId, expectedRevision, ...fields } = parse(updateTaskInput, input);
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, actor, taskId);
    assertRevision(task, expectedRevision);
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(task[k as keyof LockedTask]));
    if (changed.length === 0) return task;
    const updated = await touchTask(tx, taskId, patch);
    await appendEvent(tx, actor, 'task.edited', { projectId: task.projectId, taskId }, { fields: changed });
    return updated;
  });
}

/** Owner moves between Backlog and To Do; every other transition has its own action (tech design §3). */
export async function moveTaskStatus(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { taskId, expectedRevision, to } = parse(moveTaskStatusInput, input);
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, actor, taskId);
    assertRevision(task, expectedRevision);
    if (task.status === to) return task;
    if (task.status !== 'backlog' && task.status !== 'todo') {
      throw new AppError('INVALID_STATE', `A task in ${label(task.status)} can't be moved to ${label(to)} directly.`, { task: snapshot(task) });
    }
    const updated = await touchTask(tx, taskId, { status: to });
    await appendEvent(tx, actor, 'task.status_changed', { projectId: task.projectId, taskId }, { from: task.status, to });
    return updated;
  });
}

export async function moveTaskBoard(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { taskId, expectedRevision, boardId } = parse(moveTaskBoardInput, input);
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, actor, taskId);
    assertRevision(task, expectedRevision);
    if (task.boardId === boardId) return task;
    const [target] = await tx.select().from(boards).where(eq(boards.id, boardId));
    if (!target || target.projectId !== task.projectId) {
      throw new AppError('VALIDATION', 'Tasks can only move to another board in the same project.');
    }
    const updated = await touchTask(tx, taskId, { boardId });
    await appendEvent(tx, actor, 'task.moved_board', { projectId: task.projectId, taskId }, { fromBoardId: task.boardId, toBoardId: boardId });
    return updated;
  });
}

/** Assign or unassign before pickup. In-flight work changes hands via reassign (stage 9). */
export async function assignTask(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { taskId, expectedRevision, agentId } = parse(assignTaskInput, input);
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, actor, taskId);
    assertRevision(task, expectedRevision);
    if (task.status !== 'backlog' && task.status !== 'todo') {
      throw new AppError('INVALID_STATE', 'Work in progress is changed with Reassign, not Assign.', { task: snapshot(task) });
    }
    if (task.assigneeAgentId === agentId) return task;
    if (agentId) await assertAssignable(tx, task.workspaceId, task.projectId, agentId);
    const updated = await touchTask(tx, taskId, { assigneeAgentId: agentId });
    await appendEvent(tx, actor, 'task.assigned', { projectId: task.projectId, taskId }, { fromAgentId: task.assigneeAgentId, toAgentId: agentId });
    return updated;
  });
}

export function label(status: TaskStatus): string {
  return { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' }[status];
}
