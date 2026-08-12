ALTER TABLE "user_onboarding" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "user_onboarding" CASCADE;--> statement-breakpoint
DROP INDEX "projects_workspace_kind_idx";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."project_kind";