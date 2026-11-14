import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { activityEvents, projects } from '@/server/db/schema';
import {
  createBoard, createProject, getProject, listProjects, renameBoard, renameProject, reorderBoards,
} from '@/server/projects';
import { seedAgent, seedOwner } from './helpers';

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.code);

describe('projects and boards', () => {
  it('creates a project with its first board and logs both events', async () => {
    const owner = await seedOwner();
    const { project, board } = await createProject(owner, { name: '  Website  ' });
    expect(project.name).toBe('Website');
    expect(board).toMatchObject({ name: 'Main', position: 0, projectId: project.id });
    const events = await db.select().from(activityEvents).where(eq(activityEvents.projectId, project.id));
    expect(events.map((e) => e.type).sort()).toEqual(['board.created', 'project.created']);
  });

  it('rejects duplicate names case-insensitively, without a half-created project', async () => {
    const owner = await seedOwner();
    await createProject(owner, { name: 'Website' });
    await expect(createProject(owner, { name: 'website' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await db.select().from(projects).where(eq(projects.workspaceId, owner.workspaceId))).toHaveLength(1);
    // Another workspace may reuse the name.
    await expect(createProject(await seedOwner(), { name: 'Website' })).resolves.toBeTruthy();
  });

  it('validates names', async () => {
    const owner = await seedOwner();
    expect(await codeOf(createProject(owner, { name: '   ' }))).toBe('VALIDATION');
    expect(await codeOf(createProject(owner, { name: 'x'.repeat(81) }))).toBe('VALIDATION');
  });

  it('adds boards in order, renames and reorders them', async () => {
    const owner = await seedOwner();
    const { project, board: main } = await createProject(owner, { name: 'P' });
    const design = await createBoard(owner, { projectId: project.id, name: 'Design' });
    const dev = await createBoard(owner, { projectId: project.id, name: 'Development' });
    expect([design.position, dev.position]).toEqual([1, 2]);
    expect(await codeOf(createBoard(owner, { projectId: project.id, name: 'design' }))).toBe('VALIDATION');

    await renameBoard(owner, { boardId: dev.id, name: 'Dev' });
    await reorderBoards(owner, { projectId: project.id, boardIds: [dev.id, main.id, design.id] });
    expect((await getProject(owner, project.id)).boards.map((b) => b.name)).toEqual(['Dev', 'Main', 'Design']);
    expect(await codeOf(reorderBoards(owner, { projectId: project.id, boardIds: [dev.id, main.id] }))).toBe('VALIDATION');
  });

  it("hides other workspaces' projects behind NOT_FOUND", async () => {
    const owner = await seedOwner();
    const intruder = await seedOwner();
    const { project, board } = await createProject(owner, { name: 'Private' });
    expect(await codeOf(getProject(intruder, project.id))).toBe('NOT_FOUND');
    expect(await codeOf(renameProject(intruder, { projectId: project.id, name: 'Mine' }))).toBe('NOT_FOUND');
    expect(await codeOf(createBoard(intruder, { projectId: project.id, name: 'X' }))).toBe('NOT_FOUND');
    expect(await codeOf(renameBoard(intruder, { boardId: board.id, name: 'X' }))).toBe('NOT_FOUND');
    expect(await listProjects(intruder)).toEqual([]);
  });

  it('lets agents list only granted projects and never manage them', async () => {
    const owner = await seedOwner();
    const a = await createProject(owner, { name: 'A' });
    await createProject(owner, { name: 'B' });
    const agent = await seedAgent(owner, [a.project.id]);
    expect((await listProjects(agent)).map((p) => p.name)).toEqual(['A']);
    expect(await codeOf(createProject(agent, { name: 'C' }))).toBe('FORBIDDEN');
    expect(await listProjects(await seedAgent(owner, []))).toEqual([]);
  });
});

describe('malformed ids', () => {
  it('treats a non-uuid project id as NOT_FOUND, not a database error', async () => {
    const owner = await seedOwner();
    expect(await codeOf(getProject(owner, 'abc'))).toBe('NOT_FOUND');
  });
});
