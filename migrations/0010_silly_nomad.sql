ALTER TABLE "project_members" DROP CONSTRAINT "project_members_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
CREATE FUNCTION "set_project_member_workspace_id"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	SELECT "workspace_id" INTO NEW."workspace_id"
	FROM "projects"
	WHERE "id" = NEW."project_id";

	RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "project_members_set_workspace_id"
BEFORE INSERT OR UPDATE OF "project_id" ON "project_members"
FOR EACH ROW EXECUTE FUNCTION "set_project_member_workspace_id"();
--> statement-breakpoint
UPDATE "project_members"
SET "workspace_id" = "projects"."workspace_id"
FROM "projects"
WHERE "project_members"."project_id" = "projects"."id";
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "project_members"
		LEFT JOIN "workspace_members"
			ON "workspace_members"."workspace_id" = "project_members"."workspace_id"
			AND "workspace_members"."user_id" = "project_members"."user_id"
		WHERE "project_members"."workspace_id" IS NULL
			OR "workspace_members"."user_id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot enforce project member consistency: invalid existing project membership found';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "workspaces"
		LEFT JOIN "workspace_members"
			ON "workspace_members"."workspace_id" = "workspaces"."id"
			AND "workspace_members"."user_id" = "workspaces"."owner_id"
			AND "workspace_members"."role" = 'owner'
		WHERE "workspace_members"."user_id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot enforce workspace owner invariant: invalid existing owner found';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "projects"
		LEFT JOIN "project_members"
			ON "project_members"."project_id" = "projects"."id"
			AND "project_members"."user_id" = "projects"."owner_id"
			AND "project_members"."role" = 'owner'
		WHERE "project_members"."user_id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot enforce project owner invariant: invalid existing owner found';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "project_members" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_id_workspace_idx" ON "projects" USING btree ("id", "workspace_id");
--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_workspace_fk" FOREIGN KEY ("project_id", "workspace_id") REFERENCES "public"."projects"("id", "workspace_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_workspace_member_fk" FOREIGN KEY ("workspace_id", "user_id") REFERENCES "public"."workspace_members"("workspace_id", "user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_single_owner_idx" ON "project_members" USING btree ("project_id") WHERE "project_members"."role" = 'owner';
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_single_owner_idx" ON "workspace_members" USING btree ("workspace_id") WHERE "workspace_members"."role" = 'owner';
--> statement-breakpoint
CREATE FUNCTION "assert_workspace_owner_invariant"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	old_workspace_id uuid;
	new_workspace_id uuid;
BEGIN
	IF TG_TABLE_NAME = 'workspaces' THEN
		IF TG_OP <> 'INSERT' THEN
			old_workspace_id := OLD."id";
		END IF;
		IF TG_OP <> 'DELETE' THEN
			new_workspace_id := NEW."id";
		END IF;
	ELSE
		IF TG_OP <> 'INSERT' THEN
			old_workspace_id := OLD."workspace_id";
		END IF;
		IF TG_OP <> 'DELETE' THEN
			new_workspace_id := NEW."workspace_id";
		END IF;
	END IF;

	IF TG_OP <> 'INSERT'
		AND EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = old_workspace_id)
		AND NOT EXISTS (
			SELECT 1
			FROM "workspaces"
			INNER JOIN "workspace_members"
				ON "workspace_members"."workspace_id" = "workspaces"."id"
				AND "workspace_members"."user_id" = "workspaces"."owner_id"
				AND "workspace_members"."role" = 'owner'
			WHERE "workspaces"."id" = old_workspace_id
		)
	THEN
		RAISE EXCEPTION 'Workspace owner must be its unique owner member';
	END IF;

	IF TG_OP <> 'DELETE'
		AND new_workspace_id IS DISTINCT FROM old_workspace_id
		AND EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = new_workspace_id)
		AND NOT EXISTS (
			SELECT 1
			FROM "workspaces"
			INNER JOIN "workspace_members"
				ON "workspace_members"."workspace_id" = "workspaces"."id"
				AND "workspace_members"."user_id" = "workspaces"."owner_id"
				AND "workspace_members"."role" = 'owner'
			WHERE "workspaces"."id" = new_workspace_id
		)
	THEN
		RAISE EXCEPTION 'Workspace owner must be its unique owner member';
	END IF;

	RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "workspaces_owner_invariant"
AFTER INSERT OR UPDATE OF "owner_id" ON "workspaces"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_workspace_owner_invariant"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "workspace_members_owner_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "workspace_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_workspace_owner_invariant"();
--> statement-breakpoint
CREATE FUNCTION "assert_project_owner_invariant"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	old_project_id uuid;
	new_project_id uuid;
BEGIN
	IF TG_TABLE_NAME = 'projects' THEN
		IF TG_OP <> 'INSERT' THEN
			old_project_id := OLD."id";
		END IF;
		IF TG_OP <> 'DELETE' THEN
			new_project_id := NEW."id";
		END IF;
	ELSE
		IF TG_OP <> 'INSERT' THEN
			old_project_id := OLD."project_id";
		END IF;
		IF TG_OP <> 'DELETE' THEN
			new_project_id := NEW."project_id";
		END IF;
	END IF;

	IF TG_OP <> 'INSERT'
		AND EXISTS (SELECT 1 FROM "projects" WHERE "id" = old_project_id)
		AND NOT EXISTS (
			SELECT 1
			FROM "projects"
			INNER JOIN "project_members"
				ON "project_members"."project_id" = "projects"."id"
				AND "project_members"."workspace_id" = "projects"."workspace_id"
				AND "project_members"."user_id" = "projects"."owner_id"
				AND "project_members"."role" = 'owner'
			WHERE "projects"."id" = old_project_id
		)
	THEN
		RAISE EXCEPTION 'Project owner must be its unique owner member';
	END IF;

	IF TG_OP <> 'DELETE'
		AND new_project_id IS DISTINCT FROM old_project_id
		AND EXISTS (SELECT 1 FROM "projects" WHERE "id" = new_project_id)
		AND NOT EXISTS (
			SELECT 1
			FROM "projects"
			INNER JOIN "project_members"
				ON "project_members"."project_id" = "projects"."id"
				AND "project_members"."workspace_id" = "projects"."workspace_id"
				AND "project_members"."user_id" = "projects"."owner_id"
				AND "project_members"."role" = 'owner'
			WHERE "projects"."id" = new_project_id
		)
	THEN
		RAISE EXCEPTION 'Project owner must be its unique owner member';
	END IF;

	RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "projects_owner_invariant"
AFTER INSERT OR UPDATE OF "owner_id", "workspace_id" ON "projects"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_project_owner_invariant"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_members_owner_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "project_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_project_owner_invariant"();
