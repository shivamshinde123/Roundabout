import 'server-only';
import { and, asc, eq, gt, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from './db/client';
import { activityEvents, actors, agentConnections, taskMessages, tasks } from './db/schema';
import type { AgentActor } from './policy';
import { describeEvent, eventDetail } from '@/lib/events';

/**
 * Changes on the board that concern this agent and that someone else made (D-41):
 * its tasks, handoffs to or from it, reassignments, and messages addressed to it.
 * Read from the activity log after the agent's cursor; only list_updates advances the cursor.
 */
async function queryUpdates(actor: AgentActor, limit: number) {
  const projectIds = [...actor.projectIds];
  if (projectIds.length === 0) return [];
  const me = actor.agentId;
  const msg = sql`nullif(${activityEvents.data}->>'messageId', '')::uuid`;
  return db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      data: activityEvents.data,
      createdAt: activityEvents.createdAt,
      taskId: activityEvents.taskId,
      taskTitle: tasks.title,
      by: sql<string>`coalesce(${agentConnections.name}, 'Owner')`,
      message: sql<string | null>`(select m.body from ${taskMessages} m where m.id = ${msg})`,
      total: sql<number>`(count(*) over ())::int`,
    })
    .from(activityEvents)
    .innerJoin(actors, eq(actors.id, activityEvents.actorId))
    .leftJoin(agentConnections, eq(agentConnections.id, actors.agentConnectionId))
    .leftJoin(tasks, eq(tasks.id, activityEvents.taskId))
    .where(and(
      eq(activityEvents.workspaceId, actor.workspaceId),
      inArray(activityEvents.projectId, projectIds),
      ne(activityEvents.actorId, actor.actorId),
      gt(activityEvents.id, sql`coalesce((select updates_cursor from agent_connections where id = ${me}), 0)`),
      sql`${activityEvents.createdAt} >= (select created_at from agent_connections where id = ${me})`,
      or(
        eq(tasks.assigneeAgentId, me),
        sql`${activityEvents.data}->>'toAgentId' = ${me}`,
        sql`${activityEvents.data}->>'fromAgentId' = ${me}`,
        sql`exists (select 1 from ${taskMessages} m where m.id = ${msg} and m.recipient_actor_id = ${actor.actorId})`,
      ),
    ))
    .orderBy(asc(activityEvents.id))
    .limit(limit);
}

type Row = Awaited<ReturnType<typeof queryUpdates>>[number];

const summary = (r: Row) => `${r.by} ${describeEvent(r.type, r.data)}${r.taskTitle ? ` on "${r.taskTitle}"` : ''}`;

/** The list_updates tool: what changed for you since you last asked, oldest first. Marks them as seen. */
export async function listUpdates(actor: AgentActor) {
  const rows = await queryUpdates(actor, 50);
  const last = rows.at(-1)?.id;
  if (last !== undefined) {
    await db.update(agentConnections)
      .set({ updatesCursor: sql`greatest(coalesce(${agentConnections.updatesCursor}, 0), ${last})` })
      .where(eq(agentConnections.id, actor.agentId));
  }
  return {
    updates: rows.map((r) => ({
      type: r.type,
      summary: summary(r),
      detail: r.message ?? eventDetail(r.type, r.data),
      task: r.taskId && r.taskTitle ? { id: r.taskId, title: r.taskTitle } : null,
      by: r.by,
      at: r.createdAt.toISOString(),
    })),
    more: (rows[0]?.total ?? 0) > rows.length,
  };
}

/** A one-line nudge for other tool replies, or null when nothing is waiting. Never marks anything as seen. */
export async function pendingUpdatesNote(actor: AgentActor) {
  const rows = await queryUpdates(actor, 3);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  const examples = rows.map(summary).join('; ');
  return {
    count,
    text: `📬 ${count} new update${count === 1 ? '' : 's'} for you since you last called list_updates (${examples}${count > rows.length ? '; …' : ''}). Call list_updates to read them.`,
  };
}
