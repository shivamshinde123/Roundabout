import 'server-only';
import { and, desc, eq, gte, ilike, inArray, like, lt, or, sql } from 'drizzle-orm';
import { db } from './db/client';
import { activityEvents, actors, agentConnections, projects, tasks } from './db/schema';
import { notFound } from './errors';
import { assertOwner, type Actor } from './policy';
import { uuid } from '@/lib/schemas';

export type ActivityItem = {
  id: number;
  type: string;
  actor: { kind: string; name: string; agentId: string | null; client: string | null };
  /** Name of the agent an assignment or handoff points at, when there is one. */
  targetName: string | null;
  task: { id: string; title: string; boardId: string } | null;
  data: Record<string, unknown>;
  createdAt: Date;
};

/** Event groups the Activity page filters by (D-37). */
export const ACTIVITY_KINDS = {
  results: { label: 'Results and reviews', types: ['result.submitted', 'review.approved', 'review.changes_requested', 'task.completed'] },
  handoffs: { label: 'Handoffs', prefix: 'handoff.' },
  blockers: { label: 'Blockers', prefix: 'blocker.' },
  messages: { label: 'Messages and updates', types: ['message.posted'] },
  tasks: { label: 'Task changes', prefix: 'task.' },
  setup: { label: 'Projects, boards and agents', prefixes: ['project.', 'board.', 'agent.'] },
} as const;
export type ActivityKind = keyof typeof ACTIVITY_KINDS;

export type ActivityFilter = {
  /** A connected agent's id, or 'owner' for your own actions. */
  agentId?: string;
  handoffsOnly?: boolean;
  kind?: ActivityKind;
  types?: string[];
  boardId?: string;
  /** Inclusive calendar days, YYYY-MM-DD, in UTC. */
  from?: string;
  to?: string;
  /** Case-insensitive match on the task title. */
  q?: string;
  limit?: number;
};

const day = /^\d{4}-\d{2}-\d{2}$/;

function kindCondition(kind: ActivityKind | undefined) {
  if (!kind || !(kind in ACTIVITY_KINDS)) return undefined;
  const k = ACTIVITY_KINDS[kind] as { types?: readonly string[]; prefix?: string; prefixes?: readonly string[] };
  if (k.types) return inArray(activityEvents.type, [...k.types]);
  if (k.prefix) return like(activityEvents.type, `${k.prefix}%`);
  return or(...k.prefixes!.map((p) => like(activityEvents.type, `${p}%`)));
}

/** Project activity (atlas diagram 15), newest first, filtered by who, what kind, board, dates and task title. */
export async function listActivity(actor: Actor, projectId: string, filter: ActivityFilter = {}): Promise<ActivityItem[]> {
  assertOwner(actor);
  if (!uuid.safeParse(projectId).success) throw notFound('Project');
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project || project.workspaceId !== actor.workspaceId) throw notFound('Project');

  const rows = await db
    .select({
      e: activityEvents,
      actorKind: actors.kind,
      agentId: actors.agentConnectionId,
      actorName: sql<string>`coalesce(${agentConnections.name}, 'You')`,
      actorClient: agentConnections.client,
      targetName: sql<string | null>`(select a.name from agent_connections a where a.id = nullif(${activityEvents.data}->>'toAgentId', '')::uuid)`,
      taskTitle: tasks.title,
      boardId: tasks.boardId,
    })
    .from(activityEvents)
    .innerJoin(actors, eq(actors.id, activityEvents.actorId))
    .leftJoin(agentConnections, eq(agentConnections.id, actors.agentConnectionId))
    .leftJoin(tasks, eq(tasks.id, activityEvents.taskId))
    .where(and(
      eq(activityEvents.projectId, projectId),
      filter.agentId === 'owner' ? eq(actors.kind, 'human')
        : filter.agentId && uuid.safeParse(filter.agentId).success ? eq(actors.agentConnectionId, filter.agentId) : undefined,
      filter.handoffsOnly ? like(activityEvents.type, 'handoff.%') : undefined,
      kindCondition(filter.kind),
      filter.types?.length ? inArray(activityEvents.type, filter.types) : undefined,
      filter.boardId && uuid.safeParse(filter.boardId).success ? eq(tasks.boardId, filter.boardId) : undefined,
      filter.from && day.test(filter.from) ? gte(activityEvents.createdAt, new Date(`${filter.from}T00:00:00Z`)) : undefined,
      filter.to && day.test(filter.to) ? lt(activityEvents.createdAt, new Date(new Date(`${filter.to}T00:00:00Z`).getTime() + 86_400_000)) : undefined,
      filter.q?.trim() ? ilike(tasks.title, `%${filter.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : undefined,
    ))
    .orderBy(desc(activityEvents.id))
    .limit(filter.limit ?? 100);

  return rows.map((r) => ({
    id: r.e.id,
    type: r.e.type,
    actor: { kind: r.actorKind, name: r.actorName, agentId: r.agentId, client: r.actorClient },
    targetName: r.targetName,
    task: r.e.taskId && r.taskTitle ? { id: r.e.taskId, title: r.taskTitle, boardId: r.boardId! } : null,
    data: r.e.data,
    createdAt: r.e.createdAt,
  }));
}

/** Per-stage counts across the project's boards, for the overview (O1). */
export async function stageCounts(actor: Actor, projectId: string) {
  assertOwner(actor);
  const rows = await db
    .select({ status: tasks.status, n: sql<number>`count(*)::int` })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.projectId, projectId), eq(projects.workspaceId, actor.workspaceId)))
    .groupBy(tasks.status);
  const counts = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}
