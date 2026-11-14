import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, type Tx } from './db/client';
import { actors, agentConnections, handoffs, taskMessages, taskResults } from './db/schema';
import { AppError, notFound } from './errors';
import { appendEvent } from './events';
import { once } from './idempotency';
import { assertOwner, assertOwnsTask, type Actor } from './policy';
import { assertRevision, lockTask, snapshot, touchTask } from './tasks';
import { parse, requestChangesInput, reviewInput, submitResultInput, uuid } from '@/lib/schemas';

export type ResultView = {
  id: string;
  summary: string;
  details: string;
  links: { label: string; url: string }[];
  submittedBy: { id: string; name: string };
  reviewStatus: (typeof taskResults.$inferSelect)['reviewStatus'];
  reviewComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

/** Every submission on a task, newest first; earlier ones are kept after changes are requested (diagram 13). */
export async function listResults(taskId: string): Promise<ResultView[]> {
  const rows = await db
    .select({ r: taskResults, name: agentConnections.name })
    .from(taskResults)
    .innerJoin(agentConnections, eq(agentConnections.id, taskResults.submittedByAgentId))
    .where(eq(taskResults.taskId, taskId))
    .orderBy(desc(taskResults.createdAt));
  return rows.map(({ r, name }) => ({
    id: r.id,
    summary: r.summary,
    details: r.details,
    links: r.links,
    submittedBy: { id: r.submittedByAgentId, name },
    reviewStatus: r.reviewStatus,
    reviewComment: r.reviewComment,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
  }));
}

/** Submitting ends any pending handoff: the work it described is now being reviewed or is done. */
async function supersedePendingHandoff(tx: Tx, actor: Actor, task: { id: string; projectId: string }) {
  const superseded = await tx
    .update(handoffs)
    .set({ status: 'superseded', resolvedByActorId: actor.actorId, resolvedAt: sql`now()` })
    .where(and(eq(handoffs.taskId, task.id), eq(handoffs.status, 'pending')))
    .returning({ id: handoffs.id });
  for (const h of superseded) {
    await appendEvent(tx, actor, 'handoff.superseded', { projectId: task.projectId, taskId: task.id }, { handoffId: h.id });
  }
}

/** The owning agent submits its result. Review on → Review; review off → Done (D-3, diagram 13). */
export async function submitResult(actor: Actor, input: unknown) {
  const data = parse(submitResultInput, input);
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'submit_result', async () => {
      const task = await lockTask(tx, actor, data.taskId);
      assertOwnsTask(actor, task, snapshot(task));
      const scope = { projectId: task.projectId, taskId: task.id };
      await supersedePendingHandoff(tx, actor, task);

      const [result] = await tx
        .insert(taskResults)
        .values({
          taskId: task.id,
          submittedByAgentId: actor.agentId,
          summary: data.summary,
          details: data.details,
          links: data.links,
          reviewStatus: task.requireReview ? 'pending' : 'not_required',
        })
        .returning();
      await appendEvent(tx, actor, 'result.submitted', scope, { resultId: result.id, summary: result.summary });

      const updated = task.requireReview
        ? await touchTask(tx, task.id, { status: 'review' })
        : await touchTask(tx, task.id, { status: 'done', completedByActorId: actor.actorId, completedAt: new Date() });
      if (!task.requireReview) await appendEvent(tx, actor, 'task.completed', scope, { resultId: result.id });
      return { result: { id: result.id, review_status: result.reviewStatus }, task: { id: task.id, status: updated.status } };
    }),
  );
}

async function lockPendingReview(tx: Tx, actor: Actor, resultId: string, expectedRevision: number) {
  if (!uuid.safeParse(resultId).success) throw notFound('Result');
  const [ref] = await tx.select({ taskId: taskResults.taskId }).from(taskResults).where(eq(taskResults.id, resultId));
  if (!ref) throw notFound('Result');
  const task = await lockTask(tx, actor, ref.taskId);
  assertRevision(task, expectedRevision);
  const [result] = await tx.select().from(taskResults).where(eq(taskResults.id, resultId)).for('update');
  if (task.status !== 'review' || result.reviewStatus !== 'pending') {
    throw new AppError('CONFLICT', 'This submission is no longer waiting for review.', { task: snapshot(task) });
  }
  return { task, result };
}

/** Owner approves: Done, recording who approved (diagram 13, step 04). Human-only (§7). */
export async function approveResult(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { resultId, expectedRevision } = parse(reviewInput, input);
  return db.transaction(async (tx) => {
    const { task, result } = await lockPendingReview(tx, actor, resultId, expectedRevision);
    await tx.update(taskResults)
      .set({ reviewStatus: 'approved', reviewedByUserId: actor.userId, reviewedAt: sql`now()` })
      .where(eq(taskResults.id, result.id));
    await touchTask(tx, task.id, { status: 'done', completedByActorId: actor.actorId, completedAt: new Date() });
    const scope = { projectId: task.projectId, taskId: task.id };
    await appendEvent(tx, actor, 'review.approved', scope, { resultId: result.id });
    await appendEvent(tx, actor, 'task.completed', scope, { resultId: result.id });
    return { taskId: task.id, projectId: task.projectId };
  });
}

/** Owner requests changes: back to In Progress, earlier result kept, comment sent to the agent. */
export async function requestChanges(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { resultId, expectedRevision, comment } = parse(requestChangesInput, input);
  return db.transaction(async (tx) => {
    const { task, result } = await lockPendingReview(tx, actor, resultId, expectedRevision);
    await tx.update(taskResults)
      .set({ reviewStatus: 'changes_requested', reviewComment: comment, reviewedByUserId: actor.userId, reviewedAt: sql`now()` })
      .where(eq(taskResults.id, result.id));
    await touchTask(tx, task.id, { status: 'in_progress', nextAction: 'Address requested changes' });

    const [agentActor] = await tx.select({ id: actors.id }).from(actors).where(eq(actors.agentConnectionId, result.submittedByAgentId));
    const [m] = await tx
      .insert(taskMessages)
      .values({ taskId: task.id, senderActorId: actor.actorId, recipientActorId: agentActor?.id ?? null, kind: 'message', body: `Changes requested: ${comment}` })
      .returning({ id: taskMessages.id });
    const scope = { projectId: task.projectId, taskId: task.id };
    await appendEvent(tx, actor, 'review.changes_requested', scope, { resultId: result.id });
    await appendEvent(tx, actor, 'message.posted', scope, { messageId: m.id, kind: 'message' });
    return { taskId: task.id, projectId: task.projectId };
  });
}
