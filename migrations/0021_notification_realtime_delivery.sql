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
CREATE TRIGGER notifications_realtime_change
AFTER INSERT OR UPDATE OF read_at ON notifications
FOR EACH ROW
EXECUTE FUNCTION notify_knowmesh_notification_change();
