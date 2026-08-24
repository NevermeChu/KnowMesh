ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "search_text" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "documents"
SET "search_text" = COALESCE(
  (
    SELECT string_agg("text_node" #>> '{}', ' ' ORDER BY "ordinality")
    FROM jsonb_path_query("documents"."content", 'strict $.**.text')
      WITH ORDINALITY AS "text_nodes"("text_node", "ordinality")
  ),
  ''
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_search_text_idx" ON "documents" ("search_text");
