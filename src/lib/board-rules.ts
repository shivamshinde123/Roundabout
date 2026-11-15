import type { TaskCard, TaskStatus } from '@/server/tasks';

/**
 * Why the owner can't make this move, in plain words. Agents own the middle of the flow:
 * In Progress means an agent accepted the task, Review means it submitted a result (D-32).
 */
export function blockedMoveReason(
  task: Pick<TaskCard, 'status' | 'assignee' | 'pendingResultId' | 'requireReview'>,
  to: TaskStatus,
): string {
  const agent = task.assignee?.name;
  if (task.status === 'done') return 'Done tasks can be reopened from the task panel (open the task, then Reopen).';
  if (to === 'in_progress') {
    if (task.status === 'review') return 'This result was already handled. Open the task to see its history.';
    return agent
      ? `Only the agent can start a task. It moves to In Progress when ${agent} accepts it.`
      : 'Assign an agent first. The task moves to In Progress when that agent accepts it.';
  }
  if (to === 'review') return `A task reaches Review when ${agent ?? 'its agent'} submits a result.`;
  if (to === 'done') {
    return task.requireReview
      ? 'A task is done when you approve its result in Review.'
      : `Review is off for this task, so ${agent ?? 'its agent'} completes it directly.`;
  }
  // Back to Backlog or To Do from work that has started.
  return "Work in progress can't be moved back. Use Reassign in the task panel to hand it to someone else or send it to Backlog.";
}
