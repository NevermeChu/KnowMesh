CREATE TYPE "public"."audit_action" AS ENUM('workspace_renamed', 'workspace_ownership_transferred', 'workspace_invited', 'workspace_invitation_revoked', 'workspace_invitation_accepted', 'workspace_member_role_updated', 'workspace_member_removed', 'workspace_access_approved', 'workspace_access_rejected', 'project_created', 'project_renamed', 'project_deleted', 'project_ownership_transferred', 'project_invited', 'project_invitation_revoked', 'project_invitation_accepted', 'project_member_role_updated', 'project_member_removed', 'project_access_approved', 'project_access_rejected');--> statement-breakpoint
CREATE TYPE "public"."audit_target_kind" AS ENUM('workspace', 'project', 'member', 'invitation');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" varchar(255) NOT NULL,
	"action" "audit_action" NOT NULL,
	"target_kind" "audit_target_kind",
	"target_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(128),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_created_idx" ON "audit_logs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");