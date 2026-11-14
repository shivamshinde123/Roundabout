import 'server-only';
import { and, asc, eq, inArray, max } from 'drizzle-orm';
import { db, type Tx } from './db/client';
import { boards, projects } from './db/schema';
import { AppError, notFound } from './errors';
import { appendEvent } from './events';
import { assertOwner, assertProjectAccess, type Actor } from './policy';
import {
  createBoardInput, createProjectInput, parse, uuid, renameBoardInput, renameProjectInput, reorderBoardsInput,
} from '@/lib/schemas';

export type ProjectWithBoards = { id: string; name: string; boards: { id: string; name: string }[] };

/** Postgres unique_violation → friendly VALIDATION error. */
async function unique<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code;
    if (code === '23505') throw new AppError('VALIDATION', `A ${what} with this name already exists.`);
    throw e;
  }
}

async function loadProject(q: Tx | typeof db, actor: Actor, projectId: string) {
  if (!uuid.safeParse(projectId).success) throw notFound('Project'); // e.g. /projects/abc
  const [project] = await q.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw notFound('Project');
  assertProjectAccess(actor, { workspaceId: project.workspaceId, projectId: project.id }, 'Project');
  return project;
}

/** Projects the actor can see (owner: all; agent: granted), each with boards in order. */
export async function listProjects(actor: Actor): Promise<ProjectWithBoards[]> {
  if (actor.kind === 'agent' && actor.projectIds.size === 0) return [];
  const rows = await db
    .select({ projectId: projects.id, projectName: projects.name, boardId: boards.id, boardName: boards.name })
    .from(projects)
    .innerJoin(boards, eq(boards.projectId, projects.id))
    .where(
      actor.kind === 'agent'
        ? and(eq(projects.workspaceId, actor.workspaceId), inArray(projects.id, [...actor.projectIds]))
        : eq(projects.workspaceId, actor.workspaceId),
    )
    .orderBy(asc(projects.createdAt), asc(boards.position));

  const byId = new Map<string, ProjectWithBoards>();
  for (const r of rows) {
    const p = byId.get(r.projectId) ?? { id: r.projectId, name: r.projectName, boards: [] };
    p.boards.push({ id: r.boardId, name: r.boardName });
    byId.set(r.projectId, p);
  }
  return [...byId.values()];
}

export async function getProject(actor: Actor, projectId: string): Promise<ProjectWithBoards> {
  const project = await loadProject(db, actor, projectId);
  const list = await db
    .select({ id: boards.id, name: boards.name })
    .from(boards)
    .where(eq(boards.projectId, project.id))
    .orderBy(asc(boards.position));
  return { id: project.id, name: project.name, boards: list };
}

/** Creates the project and its first board ("Main") together (atlas diagram 03, step 02). */
export async function createProject(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { name } = parse(createProjectInput, input);
  return unique('project', () =>
    db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({ workspaceId: actor.workspaceId, name }).returning();
      const [board] = await tx.insert(boards).values({ projectId: project.id, name: 'Main', position: 0 }).returning();
      await appendEvent(tx, actor, 'project.created', { projectId: project.id }, { name });
      await appendEvent(tx, actor, 'board.created', { projectId: project.id }, { boardId: board.id, name: board.name });
      return { project, board };
    }),
  );
}

export async function renameProject(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { projectId, name } = parse(renameProjectInput, input);
  return unique('project', () =>
    db.transaction(async (tx) => {
      await loadProject(tx, actor, projectId);
      const [project] = await tx.update(projects).set({ name }).where(eq(projects.id, projectId)).returning();
      return project;
    }),
  );
}

export async function createBoard(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { projectId, name } = parse(createBoardInput, input);
  return unique('board', () =>
    db.transaction(async (tx) => {
      await loadProject(tx, actor, projectId);
      const [{ last }] = await tx.select({ last: max(boards.position) }).from(boards).where(eq(boards.projectId, projectId));
      const [board] = await tx
        .insert(boards)
        .values({ projectId, name, position: (last ?? -1) + 1 })
        .returning();
      await appendEvent(tx, actor, 'board.created', { projectId }, { boardId: board.id, name });
      return board;
    }),
  );
}

export async function renameBoard(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { boardId, name } = parse(renameBoardInput, input);
  return unique('board', () =>
    db.transaction(async (tx) => {
      const [board] = await tx.select().from(boards).where(eq(boards.id, boardId));
      if (!board) throw notFound('Board');
      await loadProject(tx, actor, board.projectId);
      const [renamed] = await tx.update(boards).set({ name }).where(eq(boards.id, boardId)).returning();
      return renamed;
    }),
  );
}

/** Set board order to exactly `boardIds` (must list every board in the project). */
export async function reorderBoards(actor: Actor, input: unknown) {
  assertOwner(actor);
  const { projectId, boardIds } = parse(reorderBoardsInput, input);
  await db.transaction(async (tx) => {
    await loadProject(tx, actor, projectId);
    const current = await tx.select({ id: boards.id }).from(boards).where(eq(boards.projectId, projectId));
    const ids = new Set(current.map((b) => b.id));
    if (ids.size !== boardIds.length || !boardIds.every((id) => ids.has(id))) {
      throw new AppError('VALIDATION', 'The new order must list every board in the project exactly once.');
    }
    for (const [position, id] of boardIds.entries()) {
      await tx.update(boards).set({ position }).where(eq(boards.id, id));
    }
  });
}
