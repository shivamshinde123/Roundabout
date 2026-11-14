import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, type Tx } from './db/client';
import { actors, agentConnections, agentProjectGrants, blockers } from './db/schema';
import { AppError, notFound } from './errors';
import { appendEvent } from './events';
import { once } from './idempotency';
import { assertOwner, assertOwnsTask, type Actor } from './policy';
import { lockTask, snapshot, touchActivity } from './tasks';
import { parse, reportBlockerInput, resolveBlockerInput, uuid } from '@/lib/schemas';

const raisedBy = alias(actors, 'raised_by');
const raisedByAgent = alias(agentConnections, 'raised_by_agent');
const needs = alias(actors, 'needs');
const needsAgent = alias(agentConnections, 'needs_agent');

export type BlockerView = {
  id: string;
  reason: string;
  question: string;
  missingResource: string | null;
  raisedBy: { actorId: string; agentId: string | null; name: string };
  needs: string; // display name; "Owner" when unspecified (null means the owner)
  status: 'open' | 'resolved';
  resolution: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

/** Blockers on a task, oldest first. Caller must have checked access to the task. */
export async function listBlockers(taskId: string): Promise<BlockerView[]> {
  const rows = await db
    .select({
      b: blockers,
      raisedAgentId: raisedBy.agentConnectionId,
      raisedName: sql<string>`coalesce(${raisedByAgent.name}, 'Owner')`,
      needsName: sql<string>`coalesce(${needsAgent.name}, 'Owner')`,
    })
    .from(blockers)
    .innerJoin(raisedBy, eq(raisedBy.id, blockers.raisedByActorId))
    .leftJoin(raisedByAgent, eq(raisedByAgent.id, raisedBy.agentConnectionId))
    .leftJoin(needs, eq(needs.id, blockers.needsActorId))
    .leftJoin(needsAgent, eq(needsAgent.id, needs.agentConnectionId))
    .where(eq(blockers.taskId, taskId))
    .orderBy(asc(blockers.createdAt));
  return rows.map(({ b, raisedAgentId, raisedName, needsName }) => ({
    id: b.id,
    reason: b.reason,
    question: b.question,
    missingResource: b.missingResource,
    raisedBy: { actorId: b.raisedByActorId, agentId: raisedAgentId, name: raisedName },
    needs: needsName,
    status: b.status,
    resolution: b.resolution,
    createdAt: b.createdAt,
    resolvedAt: b.resolvedAt,
  }));
}

async function agentActorInProject(tx: Tx, workspaceId: string, projectId: string, agentId: string) {
  const [row] = await tx
    .select({ actorId: actors.id })
    .from(actors)
    .innerJoin(agentConnections, eq(agentConnections.id, actors.agentConnectionId))
    .innerJoin(agentProjectGrants, and(eq(agentProjectGrants.agentConnectionId, agentConnections.id), eq(agentProjectGrants.projectId, projectId)))
    .where(and(eq(agentConnections.id, agentId), eq(agentConnections.workspaceId, workspaceId)));
  if (!row) throw new AppError('VALIDATION', 'That agent has no access to this project.');
  return row.actorId;
}

/** The owning agent reports what blocks it (atlas diagram 11). The card shows Blocked; the owner is alerted. */
export async function reportBlocker(actor: Actor, input: unknown) {
  const data = parse(reportBlockerInput, input);
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'report_blocker', async () => {
      const task = await lockTask(tx, actor, data.taskId);
      assertOwnsTask(actor, task, snapshot(task));
      const needsActorId = data.needs && data.needs !== 'owner'
        ? await agentActorInProject(tx, task.workspaceId, task.projectId, data.needs)
        : null;
      const [b] = await tx
        .insert(blockers)
        .values({
          taskId: task.id,
          raisedByActorId: actor.actorId,
          reason: data.reason,
          question: data.question,
          needsActorId,
          missingResource: data.missingResource || null,
        })
        .returning();
      await touchActivity(tx, task.id);
      await appendEvent(tx, actor, 'blocker.reported', { projectId: task.projectId, taskId: task.id }, { blockerId: b.id });
      return { id: b.id, status: b.status, task_id: task.id };
    }),
  );
}

async function resolve(tx: Tx, actor: Actor, blockerId: string, resolution: string, check: (task: Awaited<ReturnType<typeof lockTask>>) => void) {
  if (!uuid.safeParse(blockerId).success) throw notFound('Blocker');
  const [ref] = await tx.select({ taskId: blockers.taskId }).from(blockers).where(eq(blockers.id, blockerId));
  if (!ref) throw notFound('Blocker');
  const task = await lockTask(tx, actor, ref.taskId);
  check(task);
  const [b] = await tx.select().from(blockers).where(eq(blockers.id, blockerId)).for('update');
  if (b.status !== 'open') throw new AppError('CONFLICT', 'This blocker was already resolved.');
  await tx.update(blockers)
    .set({ status: 'resolved', resolution, resolvedByActorId: actor.actorId, resolvedAt: sql`now()` })
    .where(eq(blockers.id, blockerId));
  await touchActivity(tx, task.id);
  await appendEvent(tx, actor, 'blocker.resolved', { projectId: task.projectId, taskId: task.id }, { blockerId });
  return { id: blockerId, status: 'resolved' as const, task_id: task.id, project_id: task.projectId };
}

/** The owning agent clears its blocker once unblocked (atlas diagram 11, step 04). */
export async function clearBlocker(actor: Actor, input: unknown) {
  const data = parse(resolveBlockerInput, input);
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'clear_blocker', () =>
      resolve(tx, actor, data.blockerId, data.resolution, (task) => assertOwnsTask(actor, task, snapshot(task))),
    ),
  );
}

/** The owner resolves a blocker on the agent's behalf. */
export async function resolveBlocker(actor: Actor, input: unknown) {
  assertOwner(actor);
  const data = parse(resolveBlockerInput, input);
  return db.transaction((tx) => resolve(tx, actor, data.blockerId, data.resolution, () => {}));
}
