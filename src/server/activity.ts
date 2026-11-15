import 'server-only';
import { and, desc, eq, inArray, like, sql } from 'drizzle-orm';
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

/** Project activity (atlas diagram 15), newest first, optionally filtered by agent or to handoffs. */
export async function listActivity(
  actor: Actor,
  projectId: string,
  filter: { agentId?: string; handoffsOnly?: boolean; types?: string[]; limit?: number } = {},
): Promise<ActivityItem[]> {
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
      filter.agentId && uuid.safeParse(filter.agentId).success ? eq(actors.agentConnectionId, filter.agentId) : undefined,
      filter.handoffsOnly ? like(activityEvents.type, 'handoff.%') : undefined,
      filter.types?.length ? inArray(activityEvents.type, filter.types) : undefined,
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
