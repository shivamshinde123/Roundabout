import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { activityEvents, agentConnections, handoffs, tasks } from '@/server/db/schema';
import {
  authenticateAgent, createAgentConnection, getAgentProfile, hashToken, listAgents, revokeAgent,
  rotateAgentToken, updateAgentGrants,
} from '@/server/agents';
import { createProject } from '@/server/projects';
import { createTask } from '@/server/tasks';
import { seedOwner } from './helpers';

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e) => e.code);
const bearer = (t: string) => `Bearer ${t}`;

async function setup() {
  const owner = await seedOwner();
  const a = await createProject(owner, { name: 'A' });
  const b = await createProject(owner, { name: 'B' });
  return { owner, a, b };
}

describe('agent connections', () => {
  it('stores only a hash, shows the token once, and authenticates it', async () => {
    const { owner, a } = await setup();
    const { agent, token } = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code', projectIds: [a.project.id] });
    expect(token).toMatch(/^rbt_[A-Za-z0-9_-]{43}$/);
    const [row] = await db.select().from(agentConnections).where(eq(agentConnections.id, agent.id));
    expect(Buffer.from(row.tokenHash!).equals(hashToken(token))).toBe(true);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row).toMatchObject({ status: 'setup', tokenPrefix: token.slice(0, 12), lastContactAt: null });

    const actor = await authenticateAgent(bearer(token));
    expect(actor).toMatchObject({ kind: 'agent', agentId: agent.id, workspaceId: owner.workspaceId });
    expect([...actor.projectIds]).toEqual([a.project.id]);
    const [after] = await db.select().from(agentConnections).where(eq(agentConnections.id, agent.id));
    expect(after.status).toBe('active');
    expect(after.lastContactAt).not.toBeNull();
  });

  it('rejects missing, malformed and unknown tokens', async () => {
    await setup();
    for (const h of [null, '', 'Basic abc', 'Bearer nope', `Bearer rbt_${'x'.repeat(43)}`]) {
      expect(await codeOf(authenticateAgent(h))).toBe('UNAUTHENTICATED');
    }
  });

  it('applies grant changes on the next request and cancels affected pending handoffs', async () => {
    const { owner, a, b } = await setup();
    const one = await createAgentConnection(owner, { name: 'One', client: 'claude_code', projectIds: [a.project.id, b.project.id] });
    const two = await createAgentConnection(owner, { name: 'Two', client: 'codex', projectIds: [a.project.id, b.project.id] });
    const taskA = await createTask(owner, { boardId: a.board.id, title: 'A1' });
    const taskB = await createTask(owner, { boardId: b.board.id, title: 'B1' });
    const [hA] = await db.insert(handoffs).values({ taskId: taskA.id, fromAgentId: one.agent.id, toAgentId: two.agent.id, reason: 'r', workCompleted: 'w', nextAction: 'n' }).returning();
    const [hB] = await db.insert(handoffs).values({ taskId: taskB.id, fromAgentId: two.agent.id, toAgentId: one.agent.id, reason: 'r', workCompleted: 'w', nextAction: 'n' }).returning();

    const result = await updateAgentGrants(owner, { agentId: one.agent.id, projectIds: [a.project.id] });
    expect(result).toEqual({ added: [], removed: [b.project.id] });
    expect([...(await authenticateAgent(bearer(one.token))).projectIds]).toEqual([a.project.id]);

    const status = async (id: string) => (await db.select().from(handoffs).where(eq(handoffs.id, id)))[0].status;
    expect(await status(hA.id)).toBe('pending'); // still within granted project
    expect(await status(hB.id)).toBe('cancelled');
    const events = await db.select().from(activityEvents).where(eq(activityEvents.taskId, taskB.id));
    expect(events.map((e) => e.type)).toContain('handoff.cancelled');
  });

  it('rotating the token invalidates the old one immediately', async () => {
    const { owner } = await setup();
    const { agent, token } = await createAgentConnection(owner, { name: 'C', client: 'codex' });
    await authenticateAgent(bearer(token));
    const { token: fresh } = await rotateAgentToken(owner, { agentId: agent.id });
    expect(await codeOf(authenticateAgent(bearer(token)))).toBe('UNAUTHENTICATED');
    expect((await authenticateAgent(bearer(fresh))).agentId).toBe(agent.id);
  });

  it('revoking removes access, keeps history, and leaves assigned work visible for reassignment', async () => {
    const { owner, a } = await setup();
    const { agent, token } = await createAgentConnection(owner, { name: 'Gone', client: 'claude_code', projectIds: [a.project.id] });
    const task = await createTask(owner, { boardId: a.board.id, title: 'T', status: 'todo', assigneeAgentId: agent.id });
    await revokeAgent(owner, { agentId: agent.id });
    await revokeAgent(owner, { agentId: agent.id }); // idempotent

    expect(await codeOf(authenticateAgent(bearer(token)))).toBe('UNAUTHENTICATED');
    const [row] = await db.select().from(agentConnections).where(eq(agentConnections.id, agent.id));
    expect(row).toMatchObject({ status: 'revoked', tokenHash: null });
    const [t] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(t.assigneeAgentId).toBe(agent.id);
    expect(await codeOf(rotateAgentToken(owner, { agentId: agent.id }))).toBe('INVALID_STATE');
    expect(await codeOf(updateAgentGrants(owner, { agentId: agent.id, projectIds: [] }))).toBe('INVALID_STATE');

    const list = await listAgents(owner);
    expect(list[0]).toMatchObject({ name: 'Gone', status: 'revoked', projects: [], waiting: 1 });
  });

  it('lists agents with projects and work counts, and shows a profile', async () => {
    const { owner, a } = await setup();
    const { agent } = await createAgentConnection(owner, { name: 'Claude', client: 'claude_code', projectIds: [a.project.id] });
    await createTask(owner, { boardId: a.board.id, title: 'W', status: 'todo', assigneeAgentId: agent.id });
    const [summary] = await listAgents(owner);
    expect(summary).toMatchObject({ name: 'Claude', projects: [{ id: a.project.id, name: 'A' }], waiting: 1, inProgress: 0 });
    const profile = await getAgentProfile(owner, agent.id);
    expect(profile.work.map((w) => w.title)).toEqual(['W']);
  });

  it('keeps workspaces apart and validates input', async () => {
    const { owner, a } = await setup();
    const intruder = await seedOwner();
    const { agent } = await createAgentConnection(owner, { name: 'Mine', client: 'codex' });
    expect(await codeOf(revokeAgent(intruder, { agentId: agent.id }))).toBe('NOT_FOUND');
    expect(await codeOf(getAgentProfile(intruder, agent.id))).toBe('NOT_FOUND');
    expect(await codeOf(createAgentConnection(intruder, { name: 'X', client: 'codex', projectIds: [a.project.id] }))).toBe('VALIDATION');
    expect(await codeOf(createAgentConnection(owner, { name: 'mine', client: 'codex' }))).toBe('VALIDATION');
    expect(await codeOf(createAgentConnection(owner, { name: 'Y', client: 'gpt' }))).toBe('VALIDATION');
  });
});

describe('names', () => {
  it('frees a disconnected agent name for a new connection', async () => {
    const owner = await seedOwner();
    const { agent } = await createAgentConnection(owner, { name: 'Claude Code', client: 'claude_code' });
    await revokeAgent(owner, { agentId: agent.id });
    await expect(createAgentConnection(owner, { name: 'claude code', client: 'claude_code' })).resolves.toBeTruthy();
  });
});
