WITH ranked_workspace_invitations AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "recipient_user_id", "target_id"
			ORDER BY "created_at", "id"
		) AS duplicate_rank
	FROM "notifications"
	WHERE "type" = 'workspace_invited'
		AND "target_kind" = 'workspace'
		AND "target_id" IS NOT NULL
)
DELETE FROM "notifications"
USING ranked_workspace_invitations
WHERE "notifications"."id" = ranked_workspace_invitations."id"
	AND ranked_workspace_invitations.duplicate_rank > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_workspace_invited_recipient_target_idx" ON "notifications" USING btree ("recipient_user_id","target_id") WHERE "notifications"."type" = 'workspace_invited' and "notifications"."target_kind" = 'workspace' and "notifications"."target_id" is not null;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION notify_knowmesh_notification_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		PERFORM pg_notify(
			'knowmesh_notifications',
			json_build_object(
				'kind', 'new',
				'notificationId', NEW.id,
				'recipientUserId', NEW.recipient_user_id
			)::text
		);
	ELSIF TG_OP = 'DELETE' THEN
		PERFORM pg_notify(
			'knowmesh_notifications',
			json_build_object(
				'kind', 'count',
				'recipientUserId', OLD.recipient_user_id
			)::text
		);
		RETURN OLD;
	ELSIF OLD.read_at IS DISTINCT FROM NEW.read_at THEN
		PERFORM pg_notify(
			'knowmesh_notifications',
			json_build_object(
				'kind', 'count',
				'recipientUserId', NEW.recipient_user_id
			)::text
		);
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER notifications_realtime_change ON notifications;
--> statement-breakpoint
CREATE TRIGGER notifications_realtime_change
AFTER INSERT OR DELETE OR UPDATE OF read_at ON notifications
FOR EACH ROW
EXECUTE FUNCTION notify_knowmesh_notification_change();
