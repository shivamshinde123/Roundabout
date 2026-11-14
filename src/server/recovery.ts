import 'server-only';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db, type Tx } from './db/client';
import { agentConnections, agentProjectGrants, handoffs, taskResults } from './db/schema';
import { AppError } from './errors';
import { appendEvent } from './events';
import { assertOwner, type Actor } from './policy';
import { assertAssignable, assertRevision, lockTask, snapshot, touchTask, type LockedTask } from './tasks';
import { parse, reassignTaskInput, reopenTaskInput } from '@/lib/schemas';

/** End anything tied to the previous owner: pending handoff and pending review (tech design §6). */
async function supersedeInFlight(tx: Tx, actor: Actor, task: LockedTask) {
  const scope = { projectId: task.projectId, taskId: task.id };
  const hs = await tx
    .update(handoffs)
    .set({ status: 'superseded', resolvedByActorId: actor.actorId, resolvedAt: sql`now()` })
    .where(and(eq(handoffs.taskId, task.id), eq(handoffs.status, 'pending')))
    .returning({ id: handoffs.id });
  for (const h of hs) await appendEvent(tx, actor, 'handoff.superseded', scope, { handoffId: h.id });
  await tx
    .update(taskResults)
    .set({ reviewStatus: 'superseded' })
    .where(and(eq(taskResults.taskId, task.id), eq(taskResults.reviewStatus, 'pending')));
}

/**
 * Owner moves interrupted work (in progress, review, stalled, blocked, disconnected agent) to another agent
 * or back to the backlog. The previous assignee's later writes fail the ownership check (diagram 14).
 */
export async function reassignTask(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { taskId, expectedRevision, agentId } = parse(reassignTaskInput, input);
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, actor, taskId);
    assertRevision(task, expectedRevision);
    if (task.status === 'done') throw new AppError('INVALID_STATE', 'Reopen a completed task instead of reassigning it.', { task: snapshot(task) });
    if (agentId) await assertAssignable(tx, task.workspaceId, task.projectId, agentId);
    await supersedeInFlight(tx, actor, task);
    const updated = await touchTask(tx, task.id, {
      assigneeAgentId: agentId,
      status: agentId ? 'todo' : 'backlog',
      nextAction: null,
    });
    await appendEvent(tx, actor, 'task.reassigned', { projectId: task.projectId, taskId: task.id }, {
      fromAgentId: task.assigneeAgentId, toAgentId: agentId, fromStatus: task.status,
    });
    return updated;
  });
}

async function stillAssignable(tx: Tx, task: LockedTask) {
  if (!task.assigneeAgentId) return false;
  const [ok] = await tx
    .select({ id: agentConnections.id })
    .from(agentConnections)
    .innerJoin(agentProjectGrants, and(eq(agentProjectGrants.agentConnectionId, agentConnections.id), eq(agentProjectGrants.projectId, task.projectId)))
    .where(and(eq(agentConnections.id, task.assigneeAgentId), ne(agentConnections.status, 'revoked')));
  return Boolean(ok);
}

/** Owner reopens a Done task; results, messages and history are kept. */
export async function reopenTask(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { taskId, expectedRevision, agentId } = parse(reopenTaskInput, input);
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, actor, taskId);
    assertRevision(task, expectedRevision);
    if (task.status !== 'done') throw new AppError('INVALID_STATE', 'Only completed tasks can be reopened.', { task: snapshot(task) });
    let assignee: string | null;
    if (agentId) {
      await assertAssignable(tx, task.workspaceId, task.projectId, agentId);
      assignee = agentId;
    } else if (agentId === null) {
      assignee = null;
    } else {
      assignee = (await stillAssignable(tx, task)) ? task.assigneeAgentId : null;
    }
    const updated = await touchTask(tx, task.id, {
      status: assignee ? 'todo' : 'backlog',
      assigneeAgentId: assignee,
      completedByActorId: null,
      completedAt: null,
      nextAction: null,
    });
    await appendEvent(tx, actor, 'task.reopened', { projectId: task.projectId, taskId: task.id }, { toAgentId: assignee });
    return updated;
  });
}
