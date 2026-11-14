import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { activityEvents, idempotencyKeys } from '@/server/db/schema';
import { AppError, toErrorBody } from '@/server/errors';
import { appendEvent } from '@/server/events';
import { once } from '@/server/idempotency';
import { assertOwner, assertOwnsTask, assertProjectAccess } from '@/server/policy';
import { seedAgent, seedOwner, seedProject } from './helpers';

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as AppError).code; }
  return 'OK';
};

describe('policy', () => {
  it('owner reaches every project in their workspace only', async () => {
    const owner = await seedOwner();
    const other = await seedOwner();
    const { project } = await seedProject(owner);
    const scope = { workspaceId: owner.workspaceId, projectId: project.id };
    expect(code(() => assertProjectAccess(owner, scope))).toBe('OK');
    expect(code(() => assertProjectAccess(other, scope))).toBe('NOT_FOUND');
  });

  it('agent reaches only granted projects, and is never the owner', async () => {
    const owner = await seedOwner();
    const a = await seedProject(owner);
    const b = await seedProject(owner);
    const agent = await seedAgent(owner, [a.project.id]);
    expect(code(() => assertProjectAccess(agent, { workspaceId: owner.workspaceId, projectId: a.project.id }))).toBe('OK');
    expect(code(() => assertProjectAccess(agent, { workspaceId: owner.workspaceId, projectId: b.project.id }))).toBe('NOT_FOUND');
    expect(code(() => assertOwner(agent))).toBe('FORBIDDEN');
    expect(code(() => assertOwner(owner))).toBe('OK');
  });

  it('only the current owning agent may write to an in-progress task', async () => {
    const owner = await seedOwner();
    const { project } = await seedProject(owner);
    const mine = await seedAgent(owner, [project.id]);
    const theirs = await seedAgent(owner, [project.id]);
    const task = { status: 'in_progress', assigneeAgentId: mine.agentId };
    expect(code(() => assertOwnsTask(mine, task))).toBe('OK');
    expect(code(() => assertOwnsTask(theirs, task))).toBe('CONFLICT');
    expect(code(() => assertOwnsTask(mine, { ...task, status: 'todo' }))).toBe('CONFLICT');
    expect(code(() => assertOwnsTask(owner, task))).toBe('FORBIDDEN');
  });
});

describe('errors', () => {
  it('hides unknown errors behind a retryable INTERNAL', () => {
    const body = toErrorBody(new Error('password=hunter2'));
    expect(body.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});

describe('events', () => {
  it('appends inside the caller transaction and rolls back with it', async () => {
    const owner = await seedOwner();
    const { project } = await seedProject(owner);
    await db.transaction((tx) => appendEvent(tx, owner, 'project.created', { projectId: project.id }, { name: project.name }));
    await db
      .transaction(async (tx) => {
        await appendEvent(tx, owner, 'board.created', { projectId: project.id });
        throw new Error('abort');
      })
      .catch(() => {});
    const rows = await db.select().from(activityEvents).where(eq(activityEvents.projectId, project.id));
    expect(rows.map((r) => r.type)).toEqual(['project.created']);
    expect(rows[0]).toMatchObject({ actorId: owner.actorId, workspaceId: owner.workspaceId, data: { name: project.name } });
  });
});

describe('idempotency', () => {
  it('replays the first result for a repeated request_id', async () => {
    const owner = await seedOwner();
    const { project } = await seedProject(owner);
    const agent = await seedAgent(owner, [project.id]);
    let runs = 0;
    const call = () => db.transaction((tx) => once(tx, agent, 'req-1', 'accept_task', async () => ({ n: ++runs })));
    expect(await call()).toEqual({ n: 1 });
    expect(await call()).toEqual({ n: 1 });
    expect(runs).toBe(1);
  });

  it('runs once even when duplicates arrive concurrently', async () => {
    const owner = await seedOwner();
    const { project } = await seedProject(owner);
    const agent = await seedAgent(owner, [project.id]);
    let runs = 0;
    const call = () =>
      db.transaction((tx) =>
        once(tx, agent, 'req-race', 'post_update', async () => {
          runs++;
          await new Promise((r) => setTimeout(r, 50));
          return { ok: true };
        }),
      );
    const results = await Promise.all([call(), call(), call()]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(runs).toBe(1);
  });

  it('rejects a request_id reused for another operation, and forgets failed attempts', async () => {
    const owner = await seedOwner();
    const { project } = await seedProject(owner);
    const agent = await seedAgent(owner, [project.id]);
    await db.transaction((tx) => once(tx, agent, 'req-2', 'accept_task', async () => 1));
    await expect(db.transaction((tx) => once(tx, agent, 'req-2', 'submit_result', async () => 2))).rejects.toMatchObject({ code: 'VALIDATION' });

    await db.transaction((tx) => once(tx, agent, 'req-3', 'x', async () => { throw new AppError('CONFLICT', 'nope'); })).catch(() => {});
    const left = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'req-3'));
    expect(left).toHaveLength(0);
  });
});
