CREATE TYPE "public"."notification_target_kind" AS ENUM('workspace', 'project');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('workspace_invitation_accepted', 'workspace_access_requested', 'workspace_access_approved', 'project_invitation_accepted', 'project_access_requested', 'project_access_approved');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" varchar(255) NOT NULL,
	"actor_user_id" varchar(255),
	"type" "notification_type" NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" varchar(320) NOT NULL,
	"target_kind" "notification_target_kind",
	"target_id" uuid,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_target_pair_check" CHECK (("notifications"."target_kind" is null) = ("notifications"."target_id" is null))
);
--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_user_id") WHERE "notifications"."read_at" is null;