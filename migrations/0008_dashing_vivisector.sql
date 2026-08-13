DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "projects" AS "project"
    LEFT JOIN "workspace_members" AS "member"
      ON "member"."workspace_id" = "project"."workspace_id"
     AND "member"."user_id" = "project"."owner_id"
    WHERE "member"."user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce project owner membership: orphan project owners exist';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_owner_member_fk" FOREIGN KEY ("workspace_id","owner_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;
