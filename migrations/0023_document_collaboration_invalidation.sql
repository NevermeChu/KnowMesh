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
    payload := json_build_object(
      'kind', 'document',
      'documentId', OLD.id
    )::text;
  END IF;

  IF payload IS NOT NULL THEN
    PERFORM pg_notify('knowmesh_document_collaboration', payload);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER project_members_collaboration_role_updated
AFTER UPDATE OF role ON project_members
FOR EACH ROW
WHEN (OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION notify_document_collaboration_invalidation();
--> statement-breakpoint
CREATE TRIGGER project_members_collaboration_deleted
AFTER DELETE ON project_members
FOR EACH ROW
EXECUTE FUNCTION notify_document_collaboration_invalidation();
--> statement-breakpoint
CREATE TRIGGER sessions_collaboration_expiry_updated
AFTER UPDATE OF expires_at, user_id ON "session"
FOR EACH ROW
WHEN (
  OLD.expires_at IS DISTINCT FROM NEW.expires_at
  OR OLD.user_id IS DISTINCT FROM NEW.user_id
)
EXECUTE FUNCTION notify_document_collaboration_invalidation();
--> statement-breakpoint
CREATE TRIGGER sessions_collaboration_deleted
AFTER DELETE ON "session"
FOR EACH ROW
EXECUTE FUNCTION notify_document_collaboration_invalidation();
--> statement-breakpoint
CREATE TRIGGER documents_collaboration_project_updated
AFTER UPDATE OF project_id ON documents
FOR EACH ROW
WHEN (OLD.project_id IS DISTINCT FROM NEW.project_id)
EXECUTE FUNCTION notify_document_collaboration_invalidation();
--> statement-breakpoint
CREATE TRIGGER documents_collaboration_deleted
AFTER DELETE ON documents
FOR EACH ROW
EXECUTE FUNCTION notify_document_collaboration_invalidation();
