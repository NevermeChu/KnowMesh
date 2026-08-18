ALTER TYPE "public"."notification_type" ADD VALUE 'workspace_member_role_updated' BEFORE 'project_invitation_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'workspace_member_removed' BEFORE 'project_invitation_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'project_member_role_updated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'project_member_removed';