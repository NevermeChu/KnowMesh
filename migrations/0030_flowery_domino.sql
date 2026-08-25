ALTER TABLE "documents" ADD COLUMN "title_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION notify_document_collaboration_invalidation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload text;
BEGIN
  IF TG_TABLE_NAME = 'project_members' THEN
    IF TG_OP = 'DELETE' THEN
      payload := json_build_object(
        'kind', 'project_member',
        'projectId', OLD.project_id,
        'userId', OLD.user_id
      )::text;
    ELSE
      payload := json_build_object(
        'kind', 'project_member',
        'projectId', NEW.project_id,
        'userId', NEW.user_id
      )::text;
    END IF;
  ELSIF TG_TABLE_NAME = 'session' THEN
    IF TG_OP = 'DELETE' THEN
      payload := json_build_object(
        'kind', 'session',
        'sessionId', OLD.id,
        'userId', OLD.user_id
      )::text;
    ELSE
      payload := json_build_object(
        'kind', 'session',
        'sessionId', NEW.id,
        'userId', NEW.user_id
      )::text;
    END IF;
  ELSIF TG_TABLE_NAME = 'documents' THEN
    IF TG_OP = 'UPDATE' AND OLD.title IS DISTINCT FROM NEW.title THEN
      payload := json_build_object(
        'kind', 'document_title',
        'documentId', NEW.id,
        'title', NEW.title,
        'titleVersion', NEW.title_version
      )::text;
    ELSE
      payload := json_build_object(
        'kind', 'document',
        'documentId', OLD.id
      )::text;
    END IF;
  END IF;

  IF payload IS NOT NULL THEN
    PERFORM pg_notify('knowmesh_document_collaboration', payload);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER documents_collaboration_title_updated
AFTER UPDATE OF title ON documents
FOR EACH ROW
WHEN (OLD.title IS DISTINCT FROM NEW.title)
EXECUTE FUNCTION notify_document_collaboration_invalidation();
