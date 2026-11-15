import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, type Db, type Tx } from './db/client';
import { activityEvents, actors, projects, tasks, workspaceMembers, workspaces } from './db/schema';
import { parse, workspaceSettingsInput } from '@/lib/schemas';
import type { HumanActor } from './policy';

async function findOwner(q: Db | Tx, userId: string): Promise<HumanActor | null> {
  const [row] = await q
    .select({ workspaceId: workspaceMembers.workspaceId, actorId: actors.id })
    .from(workspaceMembers)
    .innerJoin(actors, and(eq(actors.workspaceId, workspaceMembers.workspaceId), eq(actors.userId, workspaceMembers.userId)))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, 'owner')));
  return row ? { kind: 'human', userId, ...row } : null;
}

/**
 * Return the owner's workspace, creating it (workspace + owner membership + owner actor) exactly once.
 * Safe under repeated or concurrent calls, e.g. a replayed auth callback (atlas diagram 01, step 03).
 */
export async function ensureWorkspace(userId: string): Promise<HumanActor> {
  const existing = await findOwner(db, userId);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
    const raced = await findOwner(tx, userId);
    if (raced) return raced;

    const [ws] = await tx.insert(workspaces).values({}).returning({ id: workspaces.id });
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId, role: 'owner' });
    const [actor] = await tx
      .insert(actors)
      .values({ workspaceId: ws.id, kind: 'human', userId })
      .returning({ id: actors.id });
    return { kind: 'human', userId, workspaceId: ws.id, actorId: actor.id };
  });
}

// ── Settings (D-32) ───────────────────────────────────────────────────────────

export async function getWorkspace(owner: HumanActor) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, owner.workspaceId));
  return ws;
}

export async function updateWorkspace(owner: HumanActor, input: unknown) {
  const { name, defaultRequireReview } = parse(workspaceSettingsInput, input);
  const [ws] = await db.update(workspaces).set({ name, defaultRequireReview })
    .where(eq(workspaces.id, owner.workspaceId)).returning();
  return ws;
}

/**
 * Deletes the owner's workspace (projects, boards, tasks, agents, history) and their login.
 * Order matters: tasks reference boards without a cascade, and their results/handoffs reference agents.
 * Done over the server's database connection, so the app still needs no Supabase service key (D-12).
 */
export async function deleteAccount(owner: HumanActor) {
  await db.transaction(async (tx) => {
    await tx.delete(activityEvents).where(eq(activityEvents.workspaceId, owner.workspaceId));
    await tx.delete(tasks).where(inArray(tasks.projectId,
      tx.select({ id: projects.id }).from(projects).where(eq(projects.workspaceId, owner.workspaceId))));
    await tx.delete(workspaces).where(eq(workspaces.id, owner.workspaceId)); // everything else cascades
    await tx.execute(sql`delete from auth.users where id = ${owner.userId}`); // identities and sessions cascade
  });
}
