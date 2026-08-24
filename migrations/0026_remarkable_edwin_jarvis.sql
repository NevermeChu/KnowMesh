ALTER TABLE "documents" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "sort_order" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_project_parent_sort_idx" ON "documents" USING btree ("project_id","parent_id","sort_order");