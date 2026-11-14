import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, type Tx } from './db/client';
import { agentConnections, handoffs } from './db/schema';
import { AppError, notFound } from './errors';
import { appendEvent } from './events';
import { once } from './idempotency';
import { assertOwner, assertOwnsTask, type Actor } from './policy';
import { assertAssignable, lockTask, snapshot, touchActivity, touchTask } from './tasks';
import { handoffIdInput, parse, proposeHandoffInput, respondHandoffInput, uuid } from '@/lib/schemas';

const fromAgent = alias(agentConnections, 'from_agent');
const toAgent = alias(agentConnections, 'to_agent');

export type HandoffView = {
  id: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  reason: string;
  workCompleted: string;
  nextAction: string;
  links: { label: string; url: string }[];
  status: (typeof handoffs.$inferSelect)['status'];
  declineReason: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

/** Handoff history for a task, oldest first (O4). Caller must have checked access to the task. */
export async function listHandoffs(taskId: string): Promise<HandoffView[]> {
  const rows = await db
    .select({ h: handoffs, fromName: fromAgent.name, toName: toAgent.name })
    .from(handoffs)
    .innerJoin(fromAgent, eq(fromAgent.id, handoffs.fromAgentId))
    .innerJoin(toAgent, eq(toAgent.id, handoffs.toAgentId))
    .where(eq(handoffs.taskId, taskId))
    .orderBy(asc(handoffs.createdAt));
  return rows.map(({ h, fromName, toName }) => ({
    id: h.id,
    from: { id: h.fromAgentId, name: fromName },
    to: { id: h.toAgentId, name: toName },
    reason: h.reason,
    workCompleted: h.workCompleted,
    nextAction: h.nextAction,
    links: h.links,
    status: h.status,
    declineReason: h.declineReason,
    createdAt: h.createdAt,
    resolvedAt: h.resolvedAt,
  }));
}

/** The owning agent offers the task to another agent. Ownership does not change yet (atlas diagram 12). */
export async function proposeHandoff(actor: Actor, input: unknown) {
  const data = parse(proposeHandoffInput, input);
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'propose_handoff', async () => {
      const task = await lockTask(tx, actor, data.taskId);
      assertOwnsTask(actor, task, snapshot(task));
      if (data.toAgentId === actor.agentId) throw new AppError('VALIDATION', 'Choose another agent to hand off to.');
      await assertAssignable(tx, task.workspaceId, task.projectId, data.toAgentId);
      const [pending] = await tx.select({ id: handoffs.id }).from(handoffs)
        .where(sql`${handoffs.taskId} = ${task.id} and ${handoffs.status} = 'pending'`);
      if (pending) throw new AppError('CONFLICT', 'This task already has a pending handoff.', { handoffId: pending.id });

      const [h] = await tx
        .insert(handoffs)
        .values({
          taskId: task.id,
          fromAgentId: actor.agentId,
          toAgentId: data.toAgentId,
          reason: data.reason,
          workCompleted: data.workCompleted,
          nextAction: data.nextAction,
          links: data.links,
        })
        .returning();
      await touchActivity(tx, task.id);
      await appendEvent(tx, actor, 'handoff.proposed', { projectId: task.projectId, taskId: task.id }, { handoffId: h.id, toAgentId: h.toAgentId });
      return { id: h.id, status: h.status, task_id: task.id };
    }),
  );
}

/** Lock the handoff's task first, then the handoff (technical-design-document.md §4). */
async function lockHandoff(tx: Tx, actor: Actor, handoffId: string) {
  if (!uuid.safeParse(handoffId).success) throw notFound('Handoff');
  const [ref] = await tx.select({ taskId: handoffs.taskId }).from(handoffs).where(eq(handoffs.id, handoffId));
  if (!ref) throw notFound('Handoff');
  const task = await lockTask(tx, actor, ref.taskId);
  const [h] = await tx.select().from(handoffs).where(eq(handoffs.id, handoffId)).for('update');
  return { task, h };
}

/** The recipient accepts (ownership moves, atomically) or declines (current owner keeps it). */
export async function respondToHandoff(actor: Actor, input: unknown) {
  const data = parse(respondHandoffInput, input);
  if (actor.kind !== 'agent') throw new AppError('FORBIDDEN', 'Only the receiving agent can respond to a handoff.');
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'respond_to_handoff', async () => {
      const { task, h } = await lockHandoff(tx, actor, data.handoffId);
      if (h.toAgentId !== actor.agentId) throw notFound('Handoff');
      if (h.status !== 'pending') throw new AppError('CONFLICT', `This handoff was already ${h.status}.`, { handoff: { id: h.id, status: h.status } });
      // Stale proposal: the sender no longer owns the task (reassigned, reopened, completed).
      if (task.status !== 'in_progress' || task.assigneeAgentId !== h.fromAgentId) {
        throw new AppError('CONFLICT', 'This handoff is no longer valid; the task changed hands.', { task: snapshot(task) });
      }
      const scope = { projectId: task.projectId, taskId: task.id };

      if (data.decision === 'decline') {
        await tx.update(handoffs)
          .set({ status: 'declined', declineReason: data.reason ?? null, resolvedByActorId: actor.actorId, resolvedAt: sql`now()` })
          .where(eq(handoffs.id, h.id));
        await touchActivity(tx, task.id);
        await appendEvent(tx, actor, 'handoff.declined', scope, { handoffId: h.id, reason: data.reason ?? null });
        return { handoff: { id: h.id, status: 'declined' }, task: { id: task.id, status: task.status, assignee_agent_id: task.assigneeAgentId } };
      }

      await tx.update(handoffs)
        .set({ status: 'accepted', resolvedByActorId: actor.actorId, resolvedAt: sql`now()` })
        .where(eq(handoffs.id, h.id));
      const updated = await touchTask(tx, task.id, { assigneeAgentId: actor.agentId, nextAction: h.nextAction });
      await appendEvent(tx, actor, 'handoff.accepted', scope, { handoffId: h.id, fromAgentId: h.fromAgentId });
      return { handoff: { id: h.id, status: 'accepted' }, task: { id: task.id, status: updated.status, assignee_agent_id: updated.assigneeAgentId } };
    }),
  );
}

/** The owner cancels a stalled or unwanted pending handoff; the current owner keeps the task. */
export async function cancelHandoff(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { handoffId } = parse(handoffIdInput, input);
  return db.transaction(async (tx) => {
    const { task, h } = await lockHandoff(tx, actor, handoffId);
    if (h.status !== 'pending') throw new AppError('CONFLICT', `This handoff was already ${h.status}.`);
    await tx.update(handoffs)
      .set({ status: 'cancelled', resolvedByActorId: actor.actorId, resolvedAt: sql`now()` })
      .where(eq(handoffs.id, h.id));
    await touchActivity(tx, task.id);
    await appendEvent(tx, actor, 'handoff.cancelled', { projectId: task.projectId, taskId: task.id }, { handoffId: h.id });
    return { taskId: task.id, projectId: task.projectId };
  });
}
