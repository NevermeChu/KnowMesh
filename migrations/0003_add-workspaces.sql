CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "project_member_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "projects_owner_kind_idx";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
INSERT INTO "workspaces" ("name", "owner_id", "created_at", "updated_at")
SELECT left(min("name"), 75) || ' 工作区', "owner_id", min("created_at"), max("updated_at")
FROM "projects"
GROUP BY "owner_id";--> statement-breakpoint
UPDATE "projects"
SET "workspace_id" = "workspaces"."id"
FROM "workspaces"
WHERE "workspaces"."owner_id" = "projects"."owner_id";--> statement-breakpoint
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role", "created_at")
SELECT
	"projects"."workspace_id",
	"project_members"."user_id",
	CASE
		WHEN bool_or("project_members"."role" = 'owner') THEN 'owner'::"project_member_role"
		WHEN bool_or("project_members"."role" = 'editor') THEN 'editor'::"project_member_role"
		ELSE 'viewer'::"project_member_role"
	END,
	min("project_members"."created_at")
FROM "project_members"
INNER JOIN "projects" ON "projects"."id" = "project_members"."project_id"
GROUP BY "projects"."workspace_id", "project_members"."user_id";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_members_user_workspace_idx" ON "workspace_members" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_idx" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_workspace_kind_idx" ON "projects" USING btree ("workspace_id","kind");
