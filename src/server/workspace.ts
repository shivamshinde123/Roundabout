import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db, type Db, type Tx } from './db/client';
import { actors, workspaceMembers, workspaces } from './db/schema';
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
