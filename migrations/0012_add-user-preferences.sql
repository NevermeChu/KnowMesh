CREATE TYPE "public"."user_theme_preference" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"theme" "user_theme_preference" DEFAULT 'system' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");