import 'server-only';
import type {
  NotificationTargetKind,
  NotificationType,
} from '@/features/notifications/Notification';
import { notificationBroadcaster } from '@/features/notifications/server/NotificationBroadcaster';
import type { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

type NotificationWriter = Pick<typeof db, 'insert'>;

/**
 * Inserts a notification into the database and broadcasts the real-time event to the recipient.
 *
 * @param database - Database or transaction writer.
 * @param input - Notification attributes.
 */
export async function createNotification(
  database: NotificationWriter,
  input: {
    actorUserId: string | null;
    body: string;
    recipientUserId: string;
    target: { id: string; kind: NotificationTargetKind } | null;
    title: string;
    type: NotificationType;
  },
) {
  const [notification] = await database
    .insert(notificationsSchema)
    .values({
      actorUserId: input.actorUserId,
      body: input.body,
      recipientUserId: input.recipientUserId,
      targetId: input.target?.id,
      targetKind: input.target?.kind,
      title: input.title,
      type: input.type,
    })
    .returning({
      createdAt: notificationsSchema.createdAt,
      id: notificationsSchema.id,
    });

  if (notification) {
    notificationBroadcaster.publish(input.recipientUserId, {
      payload: {
        notification: {
          body: input.body,
          createdAt: notification.createdAt.toISOString(),
          id: notification.id,
          readAt: null,
          targetId: input.target?.id ?? null,
          targetKind: input.target?.kind ?? null,
          title: input.title,
          type: input.type,
        },
      },
      type: 'notification:new',
    });
  }
}
