import 'server-only';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from './db/client';
import { agentConnections, agentProjectGrants, handoffs, taskMessages, tasks } from './db/schema';
import { notFound } from './errors';
import { assertProjectAccess, type AgentActor } from './policy';
import { getTaskDetail, queryCards, type TaskCard, type TaskDetail } from './tasks';
import { listMessages, markMessagesRead, type Message } from './messages';
import { listAssignmentsInput, parse, uuid } from '@/lib/schemas';

/** Agent-facing task shape (api-specification.md "Shared shapes"). */
export function toolTask(t: TaskCard) {
  return {
    id: t.id,
    project: { id: t.projectId, name: t.projectName },
    board: { id: t.boardId, name: t.boardName },
    title: t.title,
    status: t.status,
    require_review: t.requireReview,
    assignee: t.assignee && { id: t.assignee.id, name: t.assignee.name, client: t.assignee.client },
    next_action: t.nextAction,
    latest_result: t.latestResult,
    badges: t.badges,
    revision: t.revision,
    last_activity_at: t.lastActivityAt.toISOString(),
  };
}

function toolMessage(m: Message) {
  return {
    id: m.id,
    kind: m.kind,
    from: { kind: m.sender.kind, name: m.sender.name },
    to: m.recipient && { kind: m.recipient.kind, name: m.recipient.name },
    body: m.body,
    links: m.links,
    reply_to: m.replyTo,
    created_at: m.createdAt.toISOString(),
  };
}

/** What this agent should look at now (atlas diagram 09, step 02). */
export async function listAssignments(actor: AgentActor, input: unknown) {
  const { projectId } = parse(listAssignmentsInput, input ?? {});
  const projectIds = projectId ? [projectId].filter((p) => actor.projectIds.has(p)) : [...actor.projectIds];
  if (projectIds.length === 0) return { waiting: [], in_progress: [], handoffs_to_me: [], unread_messages: [] };

  const inScope = inArray(tasks.projectId, projectIds);
  const [mine, incoming, unread] = await Promise.all([
    queryCards(and(inScope, eq(tasks.assigneeAgentId, actor.agentId), inArray(tasks.status, ['todo', 'in_progress']))),
    db.select({
      id: handoffs.id, taskId: handoffs.taskId, reason: handoffs.reason, workCompleted: handoffs.workCompleted,
      nextAction: handoffs.nextAction, links: handoffs.links, from: agentConnections.name, createdAt: handoffs.createdAt,
    })
      .from(handoffs)
      .innerJoin(tasks, eq(tasks.id, handoffs.taskId))
      .innerJoin(agentConnections, eq(agentConnections.id, handoffs.fromAgentId))
      .where(and(inScope, eq(handoffs.toAgentId, actor.agentId), eq(handoffs.status, 'pending'))),
    db.select({ taskId: taskMessages.taskId, n: sql<number>`count(*)::int` })
      .from(taskMessages)
      .innerJoin(tasks, eq(tasks.id, taskMessages.taskId))
      .where(and(inScope, eq(taskMessages.recipientActorId, actor.actorId), isNull(taskMessages.readAt)))
      .groupBy(taskMessages.taskId),
  ]);

  return {
    waiting: mine.filter((t) => t.status === 'todo').map(toolTask),
    in_progress: mine.filter((t) => t.status === 'in_progress').map(toolTask),
    handoffs_to_me: incoming.map((h) => ({
      id: h.id, task_id: h.taskId, from: h.from, reason: h.reason, work_completed: h.workCompleted,
      next_action: h.nextAction, links: h.links, created_at: h.createdAt.toISOString(),
    })),
    unread_messages: unread.map((u) => ({ task_id: u.taskId, count: u.n })),
  };
}

/** Full task context for an agent; marks messages addressed to it as read. */
export async function getTaskForAgent(actor: AgentActor, taskId: string) {
  const task: TaskDetail = await getTaskDetail(actor, taskId);
  const messages = await listMessages(task.id);
  await markMessagesRead(actor, task.id);
  return {
    ...toolTask(task),
    instructions: task.instructions,
    expected_result: task.expectedResult,
    links: task.links,
    repository: task.repository,
    branch: task.branch,
    messages: messages.map(toolMessage),
    history: task.history.map((h) => ({ type: h.type, by: h.actorName, data: h.data, at: h.createdAt.toISOString() })),
  };
}

/** Other connected agents with access to a project (e.g. handoff recipients). */
export async function listProjectAgents(actor: AgentActor, projectId: string) {
  if (!uuid.safeParse(projectId).success) throw notFound('Project');
  assertProjectAccess(actor, { workspaceId: actor.workspaceId, projectId }, 'Project');
  return db
    .select({ id: agentConnections.id, name: agentConnections.name, client: agentConnections.client })
    .from(agentConnections)
    .innerJoin(agentProjectGrants, and(eq(agentProjectGrants.agentConnectionId, agentConnections.id), eq(agentProjectGrants.projectId, projectId)))
    .where(and(ne(agentConnections.id, actor.agentId), ne(agentConnections.status, 'revoked')));
}
