CREATE TYPE "public"."document_kind" AS ENUM('rich-text', 'whiteboard');--> statement-breakpoint
CREATE TABLE "document_whiteboard_states" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"scene" jsonb DEFAULT '{"appState":{},"elements":[],"files":{},"source":"knowmesh","type":"excalidraw","version":1}'::jsonb NOT NULL,
	"scene_schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "kind" "document_kind" DEFAULT 'rich-text' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_whiteboard_states" ADD CONSTRAINT "document_whiteboard_states_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION "assert_document_payload_kind"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	target_document_id uuid;
	target_kind document_kind;
BEGIN
	IF TG_TABLE_NAME = 'documents' THEN
		target_document_id := NEW."id";
	ELSIF TG_OP = 'DELETE' THEN
		target_document_id := OLD."document_id";
	ELSE
		target_document_id := NEW."document_id";
	END IF;

	SELECT "kind" INTO target_kind
	FROM "documents"
	WHERE "id" = target_document_id;

	IF target_kind IS NULL THEN
		RETURN NULL;
	END IF;

	IF target_kind = 'whiteboard' THEN
		IF NOT EXISTS (
			SELECT 1 FROM "document_whiteboard_states" WHERE "document_id" = target_document_id
		) THEN
			RAISE EXCEPTION 'Whiteboard document must have one whiteboard state';
		END IF;

		IF EXISTS (
			SELECT 1 FROM "document_collaboration_states" WHERE "document_id" = target_document_id
		) THEN
			RAISE EXCEPTION 'Whiteboard document cannot have rich-text collaboration state';
		END IF;
	ELSIF EXISTS (
		SELECT 1 FROM "document_whiteboard_states" WHERE "document_id" = target_document_id
	) THEN
		RAISE EXCEPTION 'Rich-text document cannot have whiteboard state';
	END IF;

	RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "documents_payload_kind_invariant"
AFTER INSERT OR UPDATE OF "kind" ON "documents"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_document_payload_kind"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "document_whiteboard_states_payload_kind_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "document_whiteboard_states"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_document_payload_kind"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "document_collaboration_states_payload_kind_invariant"
AFTER INSERT OR UPDATE ON "document_collaboration_states"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_document_payload_kind"();
