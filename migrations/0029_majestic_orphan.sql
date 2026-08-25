ALTER TYPE "public"."audit_action" ADD VALUE 'workspace_deleted' BEFORE 'workspace_renamed';--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk";
