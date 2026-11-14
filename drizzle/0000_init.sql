CREATE TABLE "activity_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"actor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"agent_connection_id" uuid,
	CONSTRAINT "actors_agent_connection_id_unique" UNIQUE("agent_connection_id"),
	CONSTRAINT "actors_workspace_user" UNIQUE("workspace_id","user_id"),
	CONSTRAINT "actors_kind_check" CHECK ((kind = 'human') = (user_id is not null) and (kind = 'agent') = (agent_connection_id is not null))
);
--> statement-breakpoint
ALTER TABLE "actors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"client" text NOT NULL,
	"token_hash" "bytea",
	"token_prefix" text,
	"status" text DEFAULT 'setup' NOT NULL,
	"last_contact_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agent_connections_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "agent_connections_client_check" CHECK (client in ('claude_code', 'codex', 'other')),
	CONSTRAINT "agent_connections_status_check" CHECK (status in ('setup', 'active', 'error', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "agent_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_project_grants" (
	"agent_connection_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_project_grants_agent_connection_id_project_id_pk" PRIMARY KEY("agent_connection_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "agent_project_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blockers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"raised_by_actor_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"question" text NOT NULL,
	"needs_actor_id" uuid,
	"missing_resource" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "blockers_status_check" CHECK (status in ('open', 'resolved'))
);
--> statement-breakpoint
ALTER TABLE "blockers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_id_project" UNIQUE("id","project_id")
);
--> statement-breakpoint
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"from_agent_id" uuid NOT NULL,
	"to_agent_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"work_completed" text NOT NULL,
	"next_action" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decline_reason" text,
	"resolved_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "handoffs_status_check" CHECK (status in ('pending', 'accepted', 'declined', 'cancelled', 'superseded')),
	CONSTRAINT "handoffs_distinct_agents" CHECK (from_agent_id <> to_agent_id)
);
--> statement-breakpoint
ALTER TABLE "handoffs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"agent_connection_id" uuid NOT NULL,
	"key" text NOT NULL,
	"operation" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_agent_connection_id_key_pk" PRIMARY KEY("agent_connection_id","key")
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"sender_actor_id" uuid NOT NULL,
	"recipient_actor_id" uuid,
	"parent_message_id" uuid,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_messages_kind_check" CHECK (kind in ('update', 'message', 'question'))
);
--> statement-breakpoint
ALTER TABLE "task_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"submitted_by_agent_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_status" text NOT NULL,
	"reviewed_by_user_id" uuid,
	"review_comment" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_results_review_status_check" CHECK (review_status in ('not_required', 'pending', 'approved', 'changes_requested', 'superseded')),
	CONSTRAINT "task_results_changes_need_comment" CHECK (review_status <> 'changes_requested' or review_comment is not null)
);
--> statement-breakpoint
ALTER TABLE "task_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"expected_result" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repository" text,
	"branch" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"require_review" boolean DEFAULT true NOT NULL,
	"assignee_agent_id" uuid,
	"next_action" text,
	"created_by_actor_id" uuid NOT NULL,
	"completed_by_actor_id" uuid,
	"completed_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status_check" CHECK (status in ('backlog', 'todo', 'in_progress', 'review', 'done')),
	CONSTRAINT "tasks_title_length" CHECK (char_length(title) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "workspace_members_role_check" CHECK (role in ('owner'))
);
--> statement-breakpoint
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'My workspace' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_agent_connection_id_agent_connections_id_fk" FOREIGN KEY ("agent_connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project_grants" ADD CONSTRAINT "agent_project_grants_agent_connection_id_agent_connections_id_fk" FOREIGN KEY ("agent_connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project_grants" ADD CONSTRAINT "agent_project_grants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_raised_by_actor_id_actors_id_fk" FOREIGN KEY ("raised_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_needs_actor_id_actors_id_fk" FOREIGN KEY ("needs_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_resolved_by_actor_id_actors_id_fk" FOREIGN KEY ("resolved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_from_agent_id_agent_connections_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_to_agent_id_agent_connections_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_resolved_by_actor_id_actors_id_fk" FOREIGN KEY ("resolved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_agent_connection_id_agent_connections_id_fk" FOREIGN KEY ("agent_connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_messages" ADD CONSTRAINT "task_messages_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_messages" ADD CONSTRAINT "task_messages_sender_actor_id_actors_id_fk" FOREIGN KEY ("sender_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_messages" ADD CONSTRAINT "task_messages_recipient_actor_id_actors_id_fk" FOREIGN KEY ("recipient_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_messages" ADD CONSTRAINT "task_messages_parent_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."task_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_submitted_by_agent_id_agent_connections_id_fk" FOREIGN KEY ("submitted_by_agent_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_results" ADD CONSTRAINT "task_results_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_agent_id_agent_connections_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agent_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_actor_id_actors_id_fk" FOREIGN KEY ("completed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_in_project_fk" FOREIGN KEY ("board_id","project_id") REFERENCES "public"."boards"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_project_created" ON "activity_events" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_task_created" ON "activity_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_project_actor_created" ON "activity_events" USING btree ("project_id","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "agent_connections_workspace_name" ON "agent_connections" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "blockers_open_by_task" ON "blockers" USING btree ("task_id") WHERE status = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "boards_project_name" ON "boards" USING btree ("project_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "handoffs_one_pending" ON "handoffs" USING btree ("task_id") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_name" ON "projects" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "task_messages_task_created" ON "task_messages" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_messages_open_questions" ON "task_messages" USING btree ("recipient_actor_id") WHERE kind = 'question' and answered_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "task_results_one_pending" ON "task_results" USING btree ("task_id") WHERE review_status = 'pending';--> statement-breakpoint
CREATE INDEX "tasks_board_status" ON "tasks" USING btree ("board_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_status" ON "tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "tasks_open_assignee" ON "tasks" USING btree ("assignee_agent_id") WHERE status in ('todo', 'in_progress');--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owner_per_workspace" ON "workspace_members" USING btree ("workspace_id") WHERE role = 'owner';--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owned_workspace_per_user" ON "workspace_members" USING btree ("user_id") WHERE role = 'owner';