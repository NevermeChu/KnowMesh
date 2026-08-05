CREATE TYPE "public"."project_kind" AS ENUM('personal', 'collaboration');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"kind" "project_kind" NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "projects_owner_kind_idx" ON "projects" USING btree ("owner_id","kind");