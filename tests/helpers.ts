// Test data helpers. Tests run against local Supabase only (see setup.ts guard).
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import {
  actors, agentConnections, agentProjectGrants, boards, projects, workspaceMembers, workspaces,
} from '@/server/db/schema';
import type { AgentActor, HumanActor } from '@/server/policy';

/**
 * Delete only data owned by test users (@test.roundabout), so a developer's local data survives test runs.
 * Order matters: activity_events has no FK to workspaces, and tasks reference actors with NO ACTION,
 * which Postgres checks before the workspace cascade reaches tasks — so clear those first.
 */
export async function resetDb() {
  const testWorkspaces = sql`(select m.workspace_id from workspace_members m
    join auth.users u on u.id = m.user_id where u.email like '%@test.roundabout')`;
  await db.execute(sql`delete from activity_events where workspace_id in ${testWorkspaces}`);
  await db.execute(sql`delete from tasks where project_id in (select id from projects where workspace_id in ${testWorkspaces})`);
  await db.execute(sql`delete from workspaces where id in ${testWorkspaces}`);
  await db.execute(sql`delete from auth.users where email like '%@test.roundabout'`);
}

export async function createUser(email = `${randomUUID()}@test.roundabout`) {
  const id = randomUUID();
  await db.execute(sql`
    insert into auth.users (id, email, aud, role, instance_id, email_confirmed_at, created_at, updated_at)
    values (${id}, ${email}, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now(), now(), now())`);
  return { id, email };
}

/** A user with a workspace, owner membership and owner actor. */
export async function seedOwner(): Promise<HumanActor> {
  const user = await createUser();
  const [ws] = await db.insert(workspaces).values({}).returning();
  await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId: user.id, role: 'owner' });
  const [actor] = await db.insert(actors).values({ workspaceId: ws.id, kind: 'human', userId: user.id }).returning();
  return { kind: 'human', actorId: actor.id, userId: user.id, workspaceId: ws.id };
}

export async function seedProject(owner: HumanActor, name = `Project ${randomUUID().slice(0, 8)}`) {
  const [project] = await db.insert(projects).values({ workspaceId: owner.workspaceId, name }).returning();
  const [board] = await db.insert(boards).values({ projectId: project.id, name: 'Main', position: 0 }).returning();
  return { project, board };
}

export async function seedAgent(
  owner: HumanActor,
  projectIds: string[],
  name = `Agent ${randomUUID().slice(0, 8)}`,
): Promise<AgentActor> {
  const [agent] = await db
    .insert(agentConnections)
    .values({ workspaceId: owner.workspaceId, name, client: 'claude_code', status: 'active' })
    .returning();
  const [actor] = await db
    .insert(actors)
    .values({ workspaceId: owner.workspaceId, kind: 'agent', agentConnectionId: agent.id })
    .returning();
  if (projectIds.length) {
    await db.insert(agentProjectGrants).values(projectIds.map((projectId) => ({ agentConnectionId: agent.id, projectId })));
  }
  return { kind: 'agent', actorId: actor.id, agentId: agent.id, workspaceId: owner.workspaceId, projectIds: new Set(projectIds) };
}
