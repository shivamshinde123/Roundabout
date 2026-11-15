import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { agentConnections, projects, tasks, workspaces } from '@/server/db/schema';
import { createAgentConnection } from '@/server/agents';
import { createProject } from '@/server/projects';
import { createTask } from '@/server/tasks';
import { deleteAccount, getWorkspace, updateWorkspace } from '@/server/workspace';
import { blockedMoveReason } from '@/lib/board-rules';
import { call } from './mcp-client';
import { seedOwner } from './helpers';

describe('workspace settings (D-32)', () => {
  it('renames the workspace and stores the review default', async () => {
    const owner = await seedOwner();
    expect(await getWorkspace(owner)).toMatchObject({ name: 'My workspace', defaultRequireReview: true });
    await updateWorkspace(owner, { name: '  Studio  ', defaultRequireReview: false });
    expect(await getWorkspace(owner)).toMatchObject({ name: 'Studio', defaultRequireReview: false });
    await expect(updateWorkspace(owner, { name: ' ', defaultRequireReview: true })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('deleting the account removes the workspace, its data and the login, and nobody else’s', async () => {
    const owner = await seedOwner();
    const other = await seedOwner();
    const { project, board } = await createProject(owner, { name: 'P' });
    const agent = await createAgentConnection(owner, { name: 'Codex', client: 'codex', projectIds: [project.id] });
    const task = await createTask(owner, { boardId: board.id, title: 'T', status: 'todo', assigneeAgentId: agent.agent.id });
    await call(agent.token, 'accept_task', { task_id: task.id });
    await call(agent.token, 'submit_result', { task_id: task.id, summary: 'done' });
    const kept = await createProject(other, { name: 'Theirs' });

    await deleteAccount(owner);

    expect(await db.select().from(workspaces).where(eq(workspaces.id, owner.workspaceId))).toEqual([]);
    expect(await db.select().from(projects).where(eq(projects.id, project.id))).toEqual([]);
    expect(await db.select().from(tasks).where(eq(tasks.id, task.id))).toEqual([]);
    expect(await db.select().from(agentConnections).where(eq(agentConnections.id, agent.agent.id))).toEqual([]);
    const users = await db.execute(sql`select id from auth.users where id = ${owner.userId}`);
    expect(users).toHaveLength(0);
    expect(await db.select().from(projects).where(eq(projects.id, kept.project.id))).toHaveLength(1);
  });
});

describe('blockedMoveReason', () => {
  const task = { status: 'todo' as const, assignee: { id: 'a', name: 'Codex', client: 'codex', status: 'active' }, pendingResultId: null, requireReview: true };
  it('explains that agents start and submit work', () => {
    expect(blockedMoveReason(task, 'in_progress')).toBe('Only the agent can start a task. It moves to In Progress when Codex accepts it.');
    expect(blockedMoveReason({ ...task, assignee: null }, 'in_progress')).toMatch(/^Assign an agent first/);
    expect(blockedMoveReason(task, 'review')).toBe('A task reaches Review when Codex submits a result.');
    expect(blockedMoveReason(task, 'done')).toMatch(/approve its result/);
    expect(blockedMoveReason({ ...task, requireReview: false }, 'done')).toMatch(/completes it directly/);
    expect(blockedMoveReason({ ...task, status: 'done' }, 'todo')).toMatch(/reopened/);
  });
});
