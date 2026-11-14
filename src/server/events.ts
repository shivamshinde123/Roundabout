import 'server-only';
import { activityEvents } from './db/schema';
import type { Tx } from './db/client';
import type { Actor } from './policy';

export type EventType =
  | 'task.created' | 'task.edited' | 'task.moved_board' | 'task.status_changed'
  | 'task.assigned' | 'task.accepted' | 'task.reassigned' | 'task.reopened'
  | 'message.posted' | 'blocker.reported' | 'blocker.resolved'
  | 'handoff.proposed' | 'handoff.accepted' | 'handoff.declined' | 'handoff.cancelled' | 'handoff.superseded'
  | 'result.submitted' | 'review.approved' | 'review.changes_requested' | 'task.completed'
  | 'agent.connected' | 'agent.access_changed' | 'agent.revoked' | 'agent.token_rotated'
  | 'project.created' | 'board.created';

/** Append one activity event inside the caller's transaction. `data` must stay small and secret-free. */
export async function appendEvent(
  tx: Tx,
  actor: Actor,
  type: EventType,
  scope: { projectId?: string | null; taskId?: string | null } = {},
  data: Record<string, unknown> = {},
) {
  await tx.insert(activityEvents).values({
    workspaceId: actor.workspaceId,
    projectId: scope.projectId ?? null,
    taskId: scope.taskId ?? null,
    actorId: actor.actorId,
    type,
    data,
  });
}
