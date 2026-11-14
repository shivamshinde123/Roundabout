ALTER TABLE "agent_project_grants" DROP CONSTRAINT "agent_project_grants_agent_connection_id_agent_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_project_grants" ADD CONSTRAINT "agent_project_grants_agent_fk" FOREIGN KEY ("agent_connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;