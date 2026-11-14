import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, type Tx } from './db/client';
import { actors, agentConnections, agentProjectGrants, taskMessages, workspaceMembers } from './db/schema';
import { AppError } from './errors';
import { appendEvent } from './events';
import { once } from './idempotency';
import { assertOwnsTask, type Actor } from './policy';
import { lockTask, touchActivity, touchTask } from './tasks';
import { parse, postMessageInput, postUpdateInput, uuid } from '@/lib/schemas';

export type Message = {
  id: string;
  kind: 'update' | 'message' | 'question';
  body: string;
  links: { label: string; url: string }[];
  sender: { actorId: string; kind: string; name: string };
  recipient: { actorId: string; kind: string; name: string } | null;
  replyTo: string | null;
  readAt: Date | null;
  answeredAt: Date | null;
  createdAt: Date;
};

const sender = alias(actors, 'sender');
const recipient = alias(actors, 'recipient');
const senderAgent = alias(agentConnections, 'sender_agent');
const recipientAgent = alias(agentConnections, 'recipient_agent');

/** All messages on a task, oldest first. Caller must have checked access to the task. */
export async function listMessages(taskId: string): Promise<Message[]> {
  const rows = await db
    .select({
      m: taskMessages,
      senderKind: sender.kind,
      senderName: sql<string>`coalesce(${senderAgent.name}, 'Owner')`,
      recipientKind: recipient.kind,
      recipientName: sql<string | null>`case when ${recipient.id} is null then null else coalesce(${recipientAgent.name}, 'Owner') end`,
    })
    .from(taskMessages)
    .innerJoin(sender, eq(sender.id, taskMessages.senderActorId))
    .leftJoin(senderAgent, eq(senderAgent.id, sender.agentConnectionId))
    .leftJoin(recipient, eq(recipient.id, taskMessages.recipientActorId))
    .leftJoin(recipientAgent, eq(recipientAgent.id, recipient.agentConnectionId))
    .where(eq(taskMessages.taskId, taskId))
    .orderBy(asc(taskMessages.createdAt));
  return rows.map((r) => ({
    id: r.m.id,
    kind: r.m.kind,
    body: r.m.body,
    links: r.m.links,
    sender: { actorId: r.m.senderActorId, kind: r.senderKind, name: r.senderName },
    recipient: r.m.recipientActorId ? { actorId: r.m.recipientActorId, kind: r.recipientKind!, name: r.recipientName! } : null,
    replyTo: r.m.parentMessageId,
    readAt: r.m.readAt,
    answeredAt: r.m.answeredAt,
    createdAt: r.m.createdAt,
  }));
}

/** Mark messages addressed to `actor` on this task as read (receipts are separate from task acceptance, §5). */
export async function markMessagesRead(actor: Actor, taskId: string) {
  if (!uuid.safeParse(taskId).success) return;
  await db
    .update(taskMessages)
    .set({ readAt: sql`now()` })
    .where(and(eq(taskMessages.taskId, taskId), eq(taskMessages.recipientActorId, actor.actorId), isNull(taskMessages.readAt)));
}

async function ownerActorId(tx: Tx, workspaceId: string) {
  const [row] = await tx
    .select({ id: actors.id })
    .from(actors)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, actors.userId), eq(workspaceMembers.workspaceId, actors.workspaceId)))
    .where(and(eq(actors.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')));
  return row.id;
}

/** Resolve `to` ('owner' | agent connection id) to an actor id the message can be addressed to. */
async function resolveRecipient(tx: Tx, workspaceId: string, projectId: string, to: string | undefined) {
  if (!to) return null;
  if (to === 'owner') return ownerActorId(tx, workspaceId);
  const [row] = await tx
    .select({ actorId: actors.id })
    .from(actors)
    .innerJoin(agentConnections, eq(agentConnections.id, actors.agentConnectionId))
    .innerJoin(agentProjectGrants, and(eq(agentProjectGrants.agentConnectionId, agentConnections.id), eq(agentProjectGrants.projectId, projectId)))
    .where(and(eq(agentConnections.id, to), eq(agentConnections.workspaceId, workspaceId)));
  if (!row) throw new AppError('VALIDATION', 'That agent has no access to this project.');
  return row.actorId;
}

/** Progress update from the owning agent; also sets the card's next action (atlas diagram 10). */
export async function postUpdate(actor: Actor, input: unknown) {
  const data = parse(postUpdateInput, input);
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'post_update', async () => {
      const task = await lockTask(tx, actor, data.taskId);
      assertOwnsTask(actor, task, { id: task.id, status: task.status, assigneeAgentId: task.assigneeAgentId });
      const [m] = await tx
        .insert(taskMessages)
        .values({ taskId: task.id, senderActorId: actor.actorId, kind: 'update', body: data.body, links: data.links ?? [] })
        .returning({ id: taskMessages.id, createdAt: taskMessages.createdAt });
      if (data.nextAction !== undefined) await touchTask(tx, task.id, { nextAction: data.nextAction || null });
      else await touchActivity(tx, task.id);
      await appendEvent(tx, actor, 'message.posted', { projectId: task.projectId, taskId: task.id }, { messageId: m.id, kind: 'update' });
      return { id: m.id, kind: 'update' as const, createdAt: m.createdAt.toISOString() };
    }),
  );
}

/** Message, question or reply from the owner or any agent with access to the task's project. */
export async function postMessage(actor: Actor, input: unknown) {
  const data = parse(postMessageInput, input);
  return db.transaction((tx) =>
    once(tx, actor, data.requestId, 'post_message', async () => {
      const task = await lockTask(tx, actor, data.taskId);
      let recipientId = await resolveRecipient(tx, task.workspaceId, task.projectId, data.to);

      if (data.replyTo) {
        const [parent] = await tx.select().from(taskMessages).where(eq(taskMessages.id, data.replyTo));
        if (!parent || parent.taskId !== task.id) throw new AppError('VALIDATION', 'You can only reply to a message on the same task.');
        recipientId ??= parent.senderActorId === actor.actorId ? null : parent.senderActorId;
        // Replying to a question addressed to you answers it (removes it from Needs your input).
        if (parent.kind === 'question' && parent.recipientActorId === actor.actorId && !parent.answeredAt) {
          await tx.update(taskMessages).set({ answeredAt: sql`now()` }).where(eq(taskMessages.id, parent.id));
        }
      }
      if (recipientId === actor.actorId) recipientId = null;
      if (data.kind === 'question' && !recipientId) throw new AppError('VALIDATION', 'A question needs a recipient (`to`).');

      const [m] = await tx
        .insert(taskMessages)
        .values({
          taskId: task.id,
          senderActorId: actor.actorId,
          recipientActorId: recipientId,
          parentMessageId: data.replyTo ?? null,
          kind: data.kind,
          body: data.body,
          links: data.links,
        })
        .returning({ id: taskMessages.id, createdAt: taskMessages.createdAt });
      await touchActivity(tx, task.id);
      await appendEvent(tx, actor, 'message.posted', { projectId: task.projectId, taskId: task.id }, { messageId: m.id, kind: data.kind, replyTo: data.replyTo ?? null });
      return { id: m.id, kind: data.kind, createdAt: m.createdAt.toISOString() };
    }),
  );
}
