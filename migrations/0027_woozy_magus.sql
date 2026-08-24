SET TIME ZONE 'UTC';--> statement-breakpoint
DROP TRIGGER IF EXISTS notifications_realtime_change ON notifications;--> statement-breakpoint
DROP TRIGGER IF EXISTS sessions_collaboration_expiry_updated ON "session";--> statement-breakpoint
ALTER TABLE "project_invitations" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "project_invitations" SET "expires_at" = "created_at" + interval '7 days';--> statement-breakpoint
ALTER TABLE "project_invitations" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" DISABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "project_members" DISABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "workspaces" DISABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "workspace_members" DISABLE TRIGGER USER;--> statement-breakpoint
DELETE FROM "workspaces" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "workspaces"."owner_id");--> statement-breakpoint
DELETE FROM "workspace_members" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "workspace_members"."user_id");--> statement-breakpoint
DELETE FROM "notifications" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "notifications"."recipient_user_id");--> statement-breakpoint
DELETE FROM "notifications" WHERE "actor_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "notifications"."actor_user_id");--> statement-breakpoint
DELETE FROM "project_access_requests" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "project_access_requests"."user_id");--> statement-breakpoint
DELETE FROM "project_invitations" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "project_invitations"."user_id");--> statement-breakpoint
DELETE FROM "project_invitations" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "project_invitations"."invited_by_id");--> statement-breakpoint
DELETE FROM "project_members" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "project_members"."user_id");--> statement-breakpoint
DELETE FROM "user_preferences" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "user_preferences"."user_id");--> statement-breakpoint
DELETE FROM "workspace_access_requests" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "workspace_access_requests"."user_id");--> statement-breakpoint
DELETE FROM "workspace_invitations" WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "workspace_invitations"."invited_by_id");--> statement-breakpoint
DELETE FROM "workspace_invitations" WHERE "accepted_by_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "workspace_invitations"."accepted_by_id");--> statement-breakpoint
DELETE FROM "workspace_invitations" a USING "workspace_invitations" b WHERE a."workspace_id" = b."workspace_id" AND a."email" = b."email" AND a."id" <> b."id" AND a."accepted_at" IS NULL AND a."revoked_at" IS NULL AND b."accepted_at" IS NULL AND b."revoked_at" IS NULL AND (a."created_at", a."id") > (b."created_at", b."id");--> statement-breakpoint
ALTER TABLE "workspace_members" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "project_members" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "projects" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_collaboration_states" ALTER COLUMN "initialized_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_collaboration_states" ALTER COLUMN "initialized_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_collaboration_states" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_collaboration_states" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "project_access_requests" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_access_requests" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "project_invitations" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_invitations" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "project_members" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_members" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "starred_documents" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "starred_documents" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspace_access_requests" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_access_requests" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspace_invitations" ALTER COLUMN "accepted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ALTER COLUMN "revoked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_access_requests" ADD CONSTRAINT "project_access_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_access_requests" ADD CONSTRAINT "workspace_access_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_id_user_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER notifications_realtime_change
AFTER INSERT OR UPDATE OF read_at ON notifications
FOR EACH ROW
EXECUTE FUNCTION notify_knowmesh_notification_change();--> statement-breakpoint
CREATE TRIGGER sessions_collaboration_expiry_updated
AFTER UPDATE OF expires_at, user_id ON "session"
FOR EACH ROW
WHEN (
  OLD.expires_at IS DISTINCT FROM NEW.expires_at
  OR OLD.user_id IS DISTINCT FROM NEW.user_id
)
EXECUTE FUNCTION notify_document_collaboration_invalidation();--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_pending_workspace_email_idx" ON "workspace_invitations" USING btree ("workspace_id","email") WHERE "workspace_invitations"."accepted_at" is null and "workspace_invitations"."revoked_at" is null;