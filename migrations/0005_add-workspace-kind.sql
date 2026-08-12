CREATE TYPE "public"."workspace_kind" AS ENUM('personal', 'team');--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "kind" "workspace_kind";--> statement-breakpoint
WITH "eligible_personal_workspaces" AS (
	SELECT
		"workspaces"."id",
		ROW_NUMBER() OVER (
			PARTITION BY "workspaces"."owner_id"
			ORDER BY "workspaces"."created_at", "workspaces"."id"
		) AS "candidate_order"
	FROM "workspaces"
	WHERE NOT EXISTS (
		SELECT 1 FROM "workspace_members"
		WHERE "workspace_members"."workspace_id" = "workspaces"."id"
			AND "workspace_members"."user_id" <> "workspaces"."owner_id"
	)
	AND NOT EXISTS (
		SELECT 1 FROM "projects"
		WHERE "projects"."workspace_id" = "workspaces"."id"
			AND "projects"."kind" = 'collaboration'
	)
)
UPDATE "workspaces"
SET "kind" = 'personal'
FROM "eligible_personal_workspaces"
WHERE "workspaces"."id" = "eligible_personal_workspaces"."id"
	AND "eligible_personal_workspaces"."candidate_order" = 1;--> statement-breakpoint
UPDATE "workspaces" SET "kind" = 'team' WHERE "kind" IS NULL;--> statement-breakpoint
WITH "known_users" AS (
	SELECT "user_id" FROM "workspace_members"
	UNION
	SELECT "owner_id" AS "user_id" FROM "projects"
)
INSERT INTO "workspaces" ("name", "owner_id", "kind")
SELECT '我的工作区', "known_users"."user_id", 'personal'
FROM "known_users"
WHERE NOT EXISTS (
	SELECT 1 FROM "workspaces"
	WHERE "workspaces"."owner_id" = "known_users"."user_id"
		AND "workspaces"."kind" = 'personal'
);--> statement-breakpoint
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT "workspaces"."id", "workspaces"."owner_id", 'owner'
FROM "workspaces"
WHERE "workspaces"."kind" = 'personal'
ON CONFLICT ("workspace_id", "user_id") DO UPDATE SET "role" = 'owner';--> statement-breakpoint
UPDATE "projects"
SET "workspace_id" = "personal_workspaces"."id"
FROM "workspaces" AS "personal_workspaces"
WHERE "projects"."kind" = 'personal'
	AND "personal_workspaces"."kind" = 'personal'
	AND "personal_workspaces"."owner_id" = "projects"."owner_id";--> statement-breakpoint
DELETE FROM "project_members"
USING "projects", "workspaces"
WHERE "project_members"."project_id" = "projects"."id"
	AND "projects"."workspace_id" = "workspaces"."id"
	AND "workspaces"."kind" = 'personal'
	AND "project_members"."user_id" <> "projects"."owner_id";--> statement-breakpoint
INSERT INTO "project_members" ("project_id", "user_id", "role")
SELECT "projects"."id", "projects"."owner_id", 'owner'
FROM "projects"
ON CONFLICT ("project_id", "user_id") DO UPDATE SET "role" = 'owner';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_personal_owner_idx" ON "workspaces" USING btree ("owner_id") WHERE "workspaces"."kind" = 'personal';--> statement-breakpoint
CREATE INDEX "projects_workspace_created_idx" ON "projects" USING btree ("workspace_id","created_at");
