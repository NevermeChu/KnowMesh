ALTER TYPE "public"."notification_type" ADD VALUE 'workspace_invited' BEFORE 'project_invitation_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'project_invited';