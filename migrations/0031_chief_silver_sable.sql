DROP INDEX "documents_project_parent_sort_idx";--> statement-breakpoint
CREATE INDEX "documents_project_parent_sort_idx" ON "documents" USING btree ("project_id","parent_id","sort_order","id");