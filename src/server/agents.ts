import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db, type Tx } from './db/client';
import {
  activityEvents, actors, agentConnections, agentProjectGrants, handoffs, projects, tasks,
} from './db/schema';
import { AppError, notFound } from './errors';
import { appendEvent } from './events';
import { assertOwner, type Actor, type AgentActor, type HumanActor } from './policy';
import { agentIdInput, createAgentInput, parse, updateGrantsInput, uuid } from '@/lib/schemas';

// ── Tokens (D-5, technical-design-document.md §7) ───────────────────────────

const TOKEN_PREFIX = 'rbt_';
export const hashToken = (token: string) => createHash('sha256').update(token).digest();

export function newToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token), prefix: token.slice(0, TOKEN_PREFIX.length + 8) };
}

/**
 * Resolve `Authorization: Bearer rbt_…` to an agent actor, or throw UNAUTHENTICATED.
 * Grants are loaded on every call, so access changes apply to the very next request (diagram 06).
 */
export async function authenticateAgent(authorization: string | null | undefined): Promise<AgentActor> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token?.startsWith(TOKEN_PREFIX)) throw new AppError('UNAUTHENTICATED', 'Missing or malformed bearer token.');

  const [agent] = await db
    .select({ id: agentConnections.id, workspaceId: agentConnections.workspaceId, actorId: actors.id })
    .from(agentConnections)
    .innerJoin(actors, eq(actors.agentConnectionId, agentConnections.id))
    .where(and(eq(agentConnections.tokenHash, hashToken(token)), ne(agentConnections.status, 'revoked')));
  if (!agent) throw new AppError('UNAUTHENTICATED', 'Invalid or revoked token. Reconnect this agent in Roundabout.');

  const [grants] = await Promise.all([
    db.select({ projectId: agentProjectGrants.projectId }).from(agentProjectGrants).where(eq(agentProjectGrants.agentConnectionId, agent.id)),
    db.update(agentConnections)
      .set({ lastContactAt: sql`now()`, status: 'active', lastError: null })
      .where(eq(agentConnections.id, agent.id)),
  ]);
  return {
    kind: 'agent',
    agentId: agent.id,
    actorId: agent.actorId,
    workspaceId: agent.workspaceId,
    projectIds: new Set(grants.map((g) => g.projectId)),
  };
}

/** Record a tool error the owner should see on the agent's profile (never secrets). */
export async function recordAgentError(agentId: string, message: string) {
  await db.update(agentConnections).set({ lastError: message.slice(0, 500) }).where(eq(agentConnections.id, agentId));
}

// ── Owner management ────────────────────────────────────────────────────────

async function loadAgent(q: Tx | typeof db, owner: HumanActor, agentId: string) {
  if (!uuid.safeParse(agentId).success) throw notFound('Agent');
  const [agent] = await q.select().from(agentConnections).where(eq(agentConnections.id, agentId));
  if (!agent || agent.workspaceId !== owner.workspaceId || agent.deletedAt) throw notFound('Agent');
  return agent;
}

async function assertOwnProjects(tx: Tx, owner: HumanActor, projectIds: string[]) {
  if (projectIds.length === 0) return;
  const found = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, owner.workspaceId), inArray(projects.id, projectIds)));
  if (found.length !== new Set(projectIds).size) throw new AppError('VALIDATION', 'Choose projects from your workspace.');
}

/** Cancel pending handoffs to or from `agentId`, optionally only in some projects (D-11). */
async function cancelPendingHandoffs(tx: Tx, owner: HumanActor, agentId: string, inProjects?: string[]) {
  if (inProjects && inProjects.length === 0) return;
  const pending = await tx
    .select({ id: handoffs.id, taskId: handoffs.taskId, projectId: tasks.projectId })
    .from(handoffs)
    .innerJoin(tasks, eq(tasks.id, handoffs.taskId))
    .where(and(
      eq(handoffs.status, 'pending'),
      or(eq(handoffs.fromAgentId, agentId), eq(handoffs.toAgentId, agentId)),
      inProjects ? inArray(tasks.projectId, inProjects) : undefined,
    ));
  for (const h of pending) {
    await tx.update(handoffs)
      .set({ status: 'cancelled', resolvedByActorId: owner.actorId, resolvedAt: sql`now()` })
      .where(eq(handoffs.id, h.id));
    await tx.update(tasks).set({ lastActivityAt: sql`now()`, revision: sql`${tasks.revision} + 1` }).where(eq(tasks.id, h.taskId));
    await appendEvent(tx, owner, 'handoff.cancelled', { projectId: h.projectId, taskId: h.taskId }, { handoffId: h.id, reason: 'agent access changed' });
  }
}

export async function createAgentConnection(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { name, client, projectIds } = parse(createAgentInput, input);
  const { token, hash, prefix } = newToken();
  // One entry per client (D-37): connecting Claude Code again refreshes the existing Claude Code connection.
  // "Other agent" stays many-to-one, since it covers different tools.
  if (client !== 'other') {
    const reused = await db.transaction(async (tx) => {
      await assertOwnProjects(tx, actor, projectIds);
      const [existing] = await tx.select().from(agentConnections).where(and(
        eq(agentConnections.workspaceId, actor.workspaceId), eq(agentConnections.client, client),
        ne(agentConnections.status, 'revoked'), isNull(agentConnections.deletedAt),
      )).for('update');
      if (!existing) return null;
      await tx.update(agentConnections)
        .set({ tokenHash: hash, tokenPrefix: prefix, status: 'setup', lastError: null })
        .where(eq(agentConnections.id, existing.id));
      await tx.delete(agentProjectGrants).where(eq(agentProjectGrants.agentConnectionId, existing.id));
      if (projectIds.length) {
        await tx.insert(agentProjectGrants).values([...new Set(projectIds)].map((projectId) => ({ agentConnectionId: existing.id, projectId })));
      }
      await appendEvent(tx, actor, 'agent.token_rotated', {}, { agentId: existing.id, projectIds });
      return existing;
    });
    if (reused) return { agent: reused, token, reused: true as const };
  }
  try {
    const agent = await db.transaction(async (tx) => {
      await assertOwnProjects(tx, actor, projectIds);
      const [agent] = await tx
        .insert(agentConnections)
        .values({ workspaceId: actor.workspaceId, name, client, tokenHash: hash, tokenPrefix: prefix, status: 'setup' })
        .returning();
      await tx.insert(actors).values({ workspaceId: actor.workspaceId, kind: 'agent', agentConnectionId: agent.id });
      if (projectIds.length) {
        await tx.insert(agentProjectGrants).values([...new Set(projectIds)].map((projectId) => ({ agentConnectionId: agent.id, projectId })));
      }
      await appendEvent(tx, actor, 'agent.connected', {}, { agentId: agent.id, name, client, projectIds });
      return agent;
    });
    return { agent, token, reused: false as const };
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === '23505') throw new AppError('VALIDATION', 'An agent with this name already exists.');
    throw e;
  }
}

export async function updateAgentGrants(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { agentId, projectIds } = parse(updateGrantsInput, input);
  const wanted = [...new Set(projectIds)];
  return db.transaction(async (tx) => {
    const agent = await loadAgent(tx, actor, agentId);
    if (agent.status === 'revoked') throw new AppError('INVALID_STATE', 'This agent is disconnected. Connect a new agent instead.');
    await assertOwnProjects(tx, actor, wanted);
    const current = (await tx.select({ projectId: agentProjectGrants.projectId }).from(agentProjectGrants)
      .where(eq(agentProjectGrants.agentConnectionId, agentId))).map((g) => g.projectId);
    const removed = current.filter((p) => !wanted.includes(p));
    const added = wanted.filter((p) => !current.includes(p));
    if (removed.length) {
      await tx.delete(agentProjectGrants).where(and(eq(agentProjectGrants.agentConnectionId, agentId), inArray(agentProjectGrants.projectId, removed)));
      await cancelPendingHandoffs(tx, actor, agentId, removed);
    }
    if (added.length) await tx.insert(agentProjectGrants).values(added.map((projectId) => ({ agentConnectionId: agentId, projectId })));
    if (removed.length || added.length) await appendEvent(tx, actor, 'agent.access_changed', {}, { agentId, added, removed });
    return { added, removed };
  });
}

/** Reconnect: issue a new token; the old one stops working immediately. */
export async function rotateAgentToken(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { agentId } = parse(agentIdInput, input);
  const { token, hash, prefix } = newToken();
  await db.transaction(async (tx) => {
    const agent = await loadAgent(tx, actor, agentId);
    if (agent.status === 'revoked') throw new AppError('INVALID_STATE', 'This agent is disconnected. Connect a new agent instead.');
    await tx.update(agentConnections).set({ tokenHash: hash, tokenPrefix: prefix, status: 'setup', lastError: null }).where(eq(agentConnections.id, agentId));
    await appendEvent(tx, actor, 'agent.token_rotated', {}, { agentId });
  });
  return { token };
}

/** Disconnect: revoke the credential and project access; keep attribution and history (diagram 06). */
/** Revoke inside `tx`: token off, grants gone, pending handoffs cancelled (D-11). */
async function revokeInTx(tx: Tx, owner: HumanActor, agent: typeof agentConnections.$inferSelect) {
  if (agent.status === 'revoked') return;
  await tx.update(agentConnections)
    .set({ status: 'revoked', tokenHash: null, revokedAt: sql`now()` })
    .where(eq(agentConnections.id, agent.id));
  await tx.delete(agentProjectGrants).where(eq(agentProjectGrants.agentConnectionId, agent.id));
  await cancelPendingHandoffs(tx, owner, agent.id);
  await appendEvent(tx, owner, 'agent.revoked', {}, { agentId: agent.id, name: agent.name });
}

export async function revokeAgent(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { agentId } = parse(agentIdInput, input);
  await db.transaction(async (tx) => revokeInTx(tx, actor, await loadAgent(tx, actor, agentId)));
}

/**
 * Removes the agent from Roundabout (D-28): disconnects it if needed, then hides it everywhere.
 * The row stays so past results, handoffs and history keep their author; tasks still assigned to it
 * show "Agent can't access" until reassigned.
 */
export async function deleteAgent(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { agentId } = parse(agentIdInput, input);
  await db.transaction(async (tx) => {
    const agent = await loadAgent(tx, actor, agentId);
    await revokeInTx(tx, actor, agent);
    await tx.update(agentConnections).set({ deletedAt: sql`now()` }).where(eq(agentConnections.id, agentId));
    await appendEvent(tx, actor, 'agent.deleted', {}, { agentId, name: agent.name });
  });
}

// ── Reads ───────────────────────────────────────────────────────────────────

export type AgentSummary = {
  id: string;
  name: string;
  client: string;
  status: string;
  tokenPrefix: string | null;
  lastContactAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  projects: { id: string; name: string }[];
  waiting: number;
  inProgress: number;
};

export async function listAgents(actor: Actor, opts: { includeDisconnected?: boolean } = { includeDisconnected: true }): Promise<AgentSummary[]> {
  assertOwner(actor);
  const rows = await db
    .select({
      agent: agentConnections,
      waiting: sql<number>`(select count(*)::int from tasks t where t.assignee_agent_id = "agent_connections"."id" and t.status = 'todo')`,
      inProgress: sql<number>`(select count(*)::int from tasks t where t.assignee_agent_id = "agent_connections"."id" and t.status = 'in_progress')`,
    })
    .from(agentConnections)
    .where(and(
      eq(agentConnections.workspaceId, actor.workspaceId), isNull(agentConnections.deletedAt),
      opts.includeDisconnected ? undefined : ne(agentConnections.status, 'revoked'),
    ))
    .orderBy(sql`${agentConnections.status} = 'revoked'`, asc(agentConnections.name));
  const grants = await db
    .select({ agentId: agentProjectGrants.agentConnectionId, id: projects.id, name: projects.name })
    .from(agentProjectGrants)
    .innerJoin(projects, eq(projects.id, agentProjectGrants.projectId))
    .where(eq(projects.workspaceId, actor.workspaceId))
    .orderBy(asc(projects.name));
  return rows.map(({ agent, waiting, inProgress }) => ({
    id: agent.id,
    name: agent.name,
    client: agent.client,
    status: agent.status,
    tokenPrefix: agent.tokenPrefix,
    lastContactAt: agent.lastContactAt,
    lastError: agent.lastError,
    createdAt: agent.createdAt,
    projects: grants.filter((g) => g.agentId === agent.id).map(({ id, name }) => ({ id, name })),
    waiting,
    inProgress,
  }));
}

export async function getAgentProfile(actor: Actor, agentId: string) {
  assertOwner(actor);
  const agent = (await listAgents(actor)).find((a) => a.id === agentId);
  if (!agent) throw notFound('Agent');
  const [work, events] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status, projectId: tasks.projectId, boardId: tasks.boardId })
      .from(tasks)
      .where(and(eq(tasks.assigneeAgentId, agentId), inArray(tasks.status, ['todo', 'in_progress', 'review'])))
      .orderBy(desc(tasks.lastActivityAt)),
    db.select({ id: activityEvents.id, type: activityEvents.type, taskId: activityEvents.taskId, createdAt: activityEvents.createdAt })
      .from(activityEvents)
      .innerJoin(actors, eq(actors.id, activityEvents.actorId))
      .where(eq(actors.agentConnectionId, agentId))
      .orderBy(desc(activityEvents.id))
      .limit(20),
  ]);
  return { ...agent, work, events };
}
