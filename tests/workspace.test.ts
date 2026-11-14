import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { actors, workspaceMembers, workspaces } from '@/server/db/schema';
import { ensureWorkspace } from '@/server/workspace';
import { safeNext } from '@/server/auth';
import { createUser } from './helpers';

describe('ensureWorkspace', () => {
  it('creates the workspace, owner membership and owner actor once', async () => {
    const user = await createUser();
    const first = await ensureWorkspace(user.id);
    const second = await ensureWorkspace(user.id);
    expect(second).toEqual(first);
    expect(first).toMatchObject({ kind: 'human', userId: user.id });
    expect(await db.select().from(workspaces).where(eq(workspaces.id, first.workspaceId))).toHaveLength(1);
    expect(await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id))).toHaveLength(1);
    expect(await db.select().from(actors).where(eq(actors.userId, user.id))).toHaveLength(1);
  });

  it('creates exactly one workspace under concurrent calls (replayed callback)', async () => {
    const user = await createUser();
    const results = await Promise.all(Array.from({ length: 5 }, () => ensureWorkspace(user.id)));
    expect(new Set(results.map((r) => r.workspaceId)).size).toBe(1);
    expect(await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id))).toHaveLength(1);
  });

  it('gives each account its own workspace', async () => {
    const a = await ensureWorkspace((await createUser()).id);
    const b = await ensureWorkspace((await createUser()).id);
    expect(a.workspaceId).not.toBe(b.workspaceId);
    expect(a.actorId).not.toBe(b.actorId);
  });
});

describe('safeNext', () => {
  it('keeps same-site paths and rejects open redirects', () => {
    expect(safeNext('/settings')).toBe('/settings');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
