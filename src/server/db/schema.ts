// Mirrors Docs/database-schema.md. Change both together.
import { sql } from 'drizzle-orm';
import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, bigint, customType,
  primaryKey, foreignKey, unique, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

export type Link = { label: string; url: string };

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const links = () => jsonb('links').$type<Link[]>().notNull().default(sql`'[]'::jsonb`);
const oneOf = (col: string, values: readonly string[]) =>
  sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(', ')})`);

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
export const AGENT_CLIENTS = ['claude_code', 'codex', 'other'] as const;
export const AGENT_STATUSES = ['setup', 'active', 'error', 'revoked'] as const;
export const MESSAGE_KINDS = ['update', 'message', 'question'] as const;
export const REVIEW_STATUSES = ['not_required', 'pending', 'approved', 'changes_requested', 'superseded'] as const;
export const HANDOFF_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'superseded'] as const;

// ── Identity ────────────────────────────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: id(),
  name: text('name').notNull().default('My workspace'),
  // Pre-ticks "Require my review" on the New task form (D-32). Agent-created tasks always require review (D-11).
  defaultRequireReview: boolean('default_require_review').notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
  check('workspace_members_role_check', oneOf('role', ['owner'])),
  uniqueIndex('workspace_members_one_owner_per_workspace').on(t.workspaceId).where(sql`role = 'owner'`),
  uniqueIndex('workspace_members_one_owned_workspace_per_user').on(t.userId).where(sql`role = 'owner'`),
]).enableRLS();

export const agentConnections = pgTable('agent_connections', {
  id: id(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  client: text('client', { enum: AGENT_CLIENTS }).notNull(),
  tokenHash: bytea('token_hash').unique(),
  tokenPrefix: text('token_prefix'),
  status: text('status', { enum: AGENT_STATUSES }).notNull().default('setup'),
  lastContactAt: ts('last_contact_at'),
  lastError: text('last_error'),
  createdAt: createdAt(),
  revokedAt: ts('revoked_at'),
  // Deleted agents vanish from lists but keep attribution in history (D-28).
  deletedAt: ts('deleted_at'),
}, (t) => [
  // Disconnected agents free their name, so "Claude Code" can be connected again (D-17).
  uniqueIndex('agent_connections_workspace_name').on(t.workspaceId, sql`lower(${t.name})`).where(sql`status <> 'revoked'`),
  check('agent_connections_client_check', oneOf('client', AGENT_CLIENTS)),
  check('agent_connections_status_check', oneOf('status', AGENT_STATUSES)),
]).enableRLS();

export const projects = pgTable('projects', {
  id: id(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('projects_workspace_name').on(t.workspaceId, sql`lower(${t.name})`),
]).enableRLS();

export const agentProjectGrants = pgTable('agent_project_grants', {
  agentConnectionId: uuid('agent_connection_id').notNull(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.agentConnectionId, t.projectId] }),
  // Explicit name: the generated one is 64 chars, over Postgres's 63-char identifier limit.
  foreignKey({ columns: [t.agentConnectionId], foreignColumns: [agentConnections.id], name: 'agent_project_grants_agent_fk' }).onDelete('cascade'),
]).enableRLS();

export const actors = pgTable('actors', {
  id: id(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['human', 'agent'] }).notNull(),
  userId: uuid('user_id').references(() => authUsers.id),
  agentConnectionId: uuid('agent_connection_id').unique().references(() => agentConnections.id),
}, (t) => [
  unique('actors_workspace_user').on(t.workspaceId, t.userId),
  check('actors_kind_check', sql`(kind = 'human') = (user_id is not null) and (kind = 'agent') = (agent_connection_id is not null)`),
]).enableRLS();

// ── Projects and boards ─────────────────────────────────────────────────────

export const boards = pgTable('boards', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('boards_project_name').on(t.projectId, sql`lower(${t.name})`),
  unique('boards_id_project').on(t.id, t.projectId),
]).enableRLS();

// ── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
  id: id(),
  projectId: uuid('project_id').notNull(),
  boardId: uuid('board_id').notNull(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull().default(''),
  expectedResult: text('expected_result').notNull().default(''),
  links: links(),
  repository: text('repository'),
  branch: text('branch'),
  status: text('status', { enum: TASK_STATUSES }).notNull().default('backlog'),
  requireReview: boolean('require_review').notNull().default(true),
  assigneeAgentId: uuid('assignee_agent_id').references(() => agentConnections.id),
  nextAction: text('next_action'),
  createdByActorId: uuid('created_by_actor_id').notNull().references(() => actors.id),
  completedByActorId: uuid('completed_by_actor_id').references(() => actors.id),
  completedAt: ts('completed_at'),
  revision: integer('revision').notNull().default(1),
  lastActivityAt: ts('last_activity_at').notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.boardId, t.projectId], foreignColumns: [boards.id, boards.projectId], name: 'tasks_board_in_project_fk' }),
  check('tasks_status_check', oneOf('status', TASK_STATUSES)),
  check('tasks_title_length', sql`char_length(title) between 1 and 200`),
  index('tasks_board_status').on(t.boardId, t.status),
  index('tasks_project_status').on(t.projectId, t.status),
  index('tasks_open_assignee').on(t.assigneeAgentId).where(sql`status in ('todo', 'in_progress')`),
]).enableRLS();

export const taskMessages = pgTable('task_messages', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  senderActorId: uuid('sender_actor_id').notNull().references(() => actors.id),
  recipientActorId: uuid('recipient_actor_id').references(() => actors.id),
  parentMessageId: uuid('parent_message_id'),
  kind: text('kind', { enum: MESSAGE_KINDS }).notNull(),
  body: text('body').notNull(),
  links: links(),
  readAt: ts('read_at'),
  answeredAt: ts('answered_at'),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.parentMessageId], foreignColumns: [t.id], name: 'task_messages_parent_fk' }),
  check('task_messages_kind_check', oneOf('kind', MESSAGE_KINDS)),
  index('task_messages_task_created').on(t.taskId, t.createdAt),
  index('task_messages_open_questions').on(t.recipientActorId).where(sql`kind = 'question' and answered_at is null`),
]).enableRLS();

export const taskResults = pgTable('task_results', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  submittedByAgentId: uuid('submitted_by_agent_id').notNull().references(() => agentConnections.id),
  summary: text('summary').notNull(),
  details: text('details').notNull().default(''),
  links: links(),
  reviewStatus: text('review_status', { enum: REVIEW_STATUSES }).notNull(),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => authUsers.id),
  reviewComment: text('review_comment'),
  reviewedAt: ts('reviewed_at'),
  createdAt: createdAt(),
}, (t) => [
  check('task_results_review_status_check', oneOf('review_status', REVIEW_STATUSES)),
  check('task_results_changes_need_comment', sql`review_status <> 'changes_requested' or review_comment is not null`),
  uniqueIndex('task_results_one_pending').on(t.taskId).where(sql`review_status = 'pending'`),
]).enableRLS();

export const handoffs = pgTable('handoffs', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  fromAgentId: uuid('from_agent_id').notNull().references(() => agentConnections.id),
  toAgentId: uuid('to_agent_id').notNull().references(() => agentConnections.id),
  reason: text('reason').notNull(),
  workCompleted: text('work_completed').notNull(),
  nextAction: text('next_action').notNull(),
  links: links(),
  status: text('status', { enum: HANDOFF_STATUSES }).notNull().default('pending'),
  declineReason: text('decline_reason'),
  resolvedByActorId: uuid('resolved_by_actor_id').references(() => actors.id),
  createdAt: createdAt(),
  resolvedAt: ts('resolved_at'),
}, (t) => [
  check('handoffs_status_check', oneOf('status', HANDOFF_STATUSES)),
  check('handoffs_distinct_agents', sql`from_agent_id <> to_agent_id`),
  uniqueIndex('handoffs_one_pending').on(t.taskId).where(sql`status = 'pending'`),
]).enableRLS();

export const blockers = pgTable('blockers', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  raisedByActorId: uuid('raised_by_actor_id').notNull().references(() => actors.id),
  reason: text('reason').notNull(),
  question: text('question').notNull(),
  needsActorId: uuid('needs_actor_id').references(() => actors.id),
  missingResource: text('missing_resource'),
  status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
  resolution: text('resolution'),
  resolvedByActorId: uuid('resolved_by_actor_id').references(() => actors.id),
  createdAt: createdAt(),
  resolvedAt: ts('resolved_at'),
}, (t) => [
  check('blockers_status_check', oneOf('status', ['open', 'resolved'])),
  index('blockers_open_by_task').on(t.taskId).where(sql`status = 'open'`),
]).enableRLS();

// ── History and reliability ─────────────────────────────────────────────────

export const activityEvents = pgTable('activity_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: uuid('workspace_id').notNull(),
  projectId: uuid('project_id'),
  taskId: uuid('task_id'),
  actorId: uuid('actor_id').notNull().references(() => actors.id),
  type: text('type').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
}, (t) => [
  index('activity_project_created').on(t.projectId, t.createdAt.desc()),
  index('activity_task_created').on(t.taskId, t.createdAt),
  index('activity_project_actor_created').on(t.projectId, t.actorId, t.createdAt.desc()),
]).enableRLS();

export const idempotencyKeys = pgTable('idempotency_keys', {
  agentConnectionId: uuid('agent_connection_id').notNull().references(() => agentConnections.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  operation: text('operation').notNull(),
  response: jsonb('response').notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.agentConnectionId, t.key] })]).enableRLS();
