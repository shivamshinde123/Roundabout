// Access rules shared by the board and the agent tools (technical-design-document.md §2).
// Pure functions: callers load the rows (inside their transaction) and pass them in.
import { AppError, notFound } from './errors';

export type HumanActor = { kind: 'human'; actorId: string; userId: string; workspaceId: string };
export type AgentActor = {
  kind: 'agent';
  actorId: string;
  agentId: string;
  workspaceId: string;
  projectIds: ReadonlySet<string>;
};
export type Actor = HumanActor | AgentActor;

type Scoped = { workspaceId: string; projectId: string };

export function assertWorkspace(actor: Actor, workspaceId: string, what?: string): void {
  if (actor.workspaceId !== workspaceId) throw notFound(what);
}

/** Owner: any project in the workspace. Agent: only granted projects. Failures look like NOT_FOUND. */
export function assertProjectAccess(actor: Actor, target: Scoped, what?: string): void {
  assertWorkspace(actor, target.workspaceId, what);
  if (actor.kind === 'agent' && !actor.projectIds.has(target.projectId)) throw notFound(what);
}

export function assertOwner(actor: Actor): asserts actor is HumanActor {
  if (actor.kind !== 'human') throw new AppError('FORBIDDEN', 'Only the workspace owner can do this.');
}

/** Agent writes to an in-flight task require the agent to own it right now. */
export function assertOwnsTask(
  actor: Actor,
  task: { status: string; assigneeAgentId: string | null },
  snapshot?: Record<string, unknown>,
): asserts actor is AgentActor {
  if (actor.kind !== 'agent') throw new AppError('FORBIDDEN', 'Only the agent working on this task can do this.');
  if (task.status !== 'in_progress' || task.assigneeAgentId !== actor.agentId) {
    throw new AppError('CONFLICT', 'You no longer own this task.', snapshot ? { task: snapshot } : undefined);
  }
}
