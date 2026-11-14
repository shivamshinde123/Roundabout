import 'server-only';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from './db/client';
import { agentConnections, blockers, projects, taskMessages, taskResults, tasks } from './db/schema';
import { assertOwner, type Actor } from './policy';
import { queryCards, type TaskCard } from './tasks';

type TaskRef = { id: string; title: string; projectId: string; boardId: string; revision: number };

export type InboxItem =
  | { kind: 'review'; key: string; task: TaskRef; resultId: string; summary: string; from: string; at: Date }
  | { kind: 'blocked'; key: string; task: TaskRef; blockerId: string; reason: string; question: string; from: string; at: Date }
  | { kind: 'question'; key: string; task: TaskRef; messageId: string; body: string; from: string; at: Date }
  | { kind: 'stalled'; key: string; task: TaskRef; detail: string; at: Date }
  | { kind: 'no_access'; key: string; task: TaskRef; detail: string; at: Date };

const ORDER: InboxItem['kind'][] = ['review', 'blocked', 'question', 'no_access', 'stalled'];

const ref = (t: { id: string; title: string; projectId: string; boardId: string; revision: number }): TaskRef =>
  ({ id: t.id, title: t.title, projectId: t.projectId, boardId: t.boardId, revision: t.revision });

/**
 * Needs your input (O5, atlas diagram 16): pending reviews, open blockers, unanswered questions to the owner,
 * work whose agent lost access, and stalled work. Computed on read — there is no inbox table.
 */
export async function listInbox(actor: Actor, projectIds?: string[]): Promise<InboxItem[]> {
  assertOwner(actor);
  const ids = projectIds ?? (await db.select({ id: projects.id }).from(projects).where(eq(projects.workspaceId, actor.workspaceId))).map((p) => p.id);
  if (ids.length === 0) return [];
  const inScope = and(inArray(tasks.projectId, ids), eq(projects.workspaceId, actor.workspaceId));
  const taskCols = { id: tasks.id, title: tasks.title, projectId: tasks.projectId, boardId: tasks.boardId, revision: tasks.revision };

  const [reviews, openBlockers, questions, cards] = await Promise.all([
    db.select({ t: taskCols, resultId: taskResults.id, summary: taskResults.summary, from: agentConnections.name, at: taskResults.createdAt })
      .from(taskResults)
      .innerJoin(tasks, eq(tasks.id, taskResults.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(agentConnections, eq(agentConnections.id, taskResults.submittedByAgentId))
      .where(and(inScope, eq(taskResults.reviewStatus, 'pending'), eq(tasks.status, 'review'))),
    db.select({
      t: taskCols, blockerId: blockers.id, reason: blockers.reason, question: blockers.question, at: blockers.createdAt,
      from: sql<string>`coalesce((select ac.name from actors a join agent_connections ac on ac.id = a.agent_connection_id where a.id = "blockers"."raised_by_actor_id"), 'Owner')`,
    })
      .from(blockers)
      .innerJoin(tasks, eq(tasks.id, blockers.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(inScope, eq(blockers.status, 'open'))),
    db.select({
      t: taskCols, messageId: taskMessages.id, body: taskMessages.body, at: taskMessages.createdAt,
      from: sql<string>`coalesce((select ac.name from actors a join agent_connections ac on ac.id = a.agent_connection_id where a.id = "task_messages"."sender_actor_id"), 'Owner')`,
    })
      .from(taskMessages)
      .innerJoin(tasks, eq(tasks.id, taskMessages.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(inScope, eq(taskMessages.kind, 'question'), eq(taskMessages.recipientActorId, actor.actorId), isNull(taskMessages.answeredAt))),
    queryCards(and(inArray(tasks.projectId, ids), ne(tasks.status, 'done'))),
  ]);

  const items: InboxItem[] = [
    ...reviews.map((r) => ({ kind: 'review' as const, key: `review:${r.resultId}`, task: ref(r.t), resultId: r.resultId, summary: r.summary, from: r.from, at: r.at })),
    ...openBlockers.map((b) => ({ kind: 'blocked' as const, key: `blocker:${b.blockerId}`, task: ref(b.t), blockerId: b.blockerId, reason: b.reason, question: b.question, from: b.from, at: b.at })),
    ...questions.map((q) => ({ kind: 'question' as const, key: `question:${q.messageId}`, task: ref(q.t), messageId: q.messageId, body: q.body, from: q.from, at: q.at })),
    ...cards.filter((c) => c.badges.includes('agent_no_access')).map((c) => ({
      kind: 'no_access' as const, key: `no_access:${c.id}`, task: ref(c),
      detail: `${c.assignee?.name ?? 'The agent'} can't access this task anymore`, at: c.lastActivityAt,
    })),
    ...cards.filter((c) => c.badges.includes('stalled') && !c.badges.includes('agent_no_access')).map((c) => ({
      kind: 'stalled' as const, key: `stalled:${c.id}`, task: ref(c), detail: stalledDetail(c), at: c.lastActivityAt,
    })),
  ];
  return items.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.at.getTime() - a.at.getTime());
}

function stalledDetail(c: TaskCard) {
  if (c.badges.includes('waiting_for_pickup')) return `Waiting for ${c.assignee?.name ?? 'pickup'} to pick it up`;
  if (c.badges.includes('handoff_pending')) return `Handoff to ${c.handoffTo ?? 'another agent'} not accepted`;
  return `No update from ${c.assignee?.name ?? 'the agent'}`;
}

/** Open-item counts per project, for the sidebar alert badges. */
export async function inboxCounts(actor: Actor): Promise<Record<string, number>> {
  const items = await listInbox(actor);
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.task.projectId] = (counts[i.task.projectId] ?? 0) + 1;
  return counts;
}
