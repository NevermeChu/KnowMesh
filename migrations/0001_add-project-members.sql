CREATE TYPE "public"."project_member_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "project_member_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "project_members" ("project_id", "user_id", "role", "created_at")
SELECT "id", "owner_id", 'owner', "created_at" FROM "projects";--> statement-breakpoint
CREATE INDEX "project_members_user_project_idx" ON "project_members" USING btree ("user_id","project_id");
