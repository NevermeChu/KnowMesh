CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
DROP INDEX IF EXISTS "documents_search_text_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_search_text_trgm_idx" ON "documents" USING gin ("search_text" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_title_trgm_idx" ON "documents" USING gin ("title" gin_trgm_ops);
