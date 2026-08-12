CREATE TABLE "user_onboarding" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"initialized_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "project_member_role" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_id" varchar(255) NOT NULL,
	"accepted_by_id" varchar(255),
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_token_hash_idx" ON "workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_email_idx" ON "workspace_invitations" USING btree ("workspace_id","email");