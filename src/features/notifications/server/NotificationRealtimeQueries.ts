import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { RealtimeNotificationItem } from '@/features/notifications/Notification';
import { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

/**
 * Loads one persisted notification for realtime delivery to its recipient.
 *
 * @param input - Notification and recipient identifiers from a trusted database signal.
 * @returns Realtime notification payload, or null when it no longer exists.
 */
export async function getRealtimeNotification(input: {
  notificationId: string;
  recipientUserId: string;
}): Promise<RealtimeNotificationItem | null> {
  const [notification] = await db
    .select({
      body: notificationsSchema.body,
      createdAt: notificationsSchema.createdAt,
      id: notificationsSchema.id,
      readAt: notificationsSchema.readAt,
      targetId: notificationsSchema.targetId,
      targetKind: notificationsSchema.targetKind,
      title: notificationsSchema.title,
      type: notificationsSchema.type,
    })
    .from(notificationsSchema)
    .where(
      and(
        eq(notificationsSchema.id, input.notificationId),
        eq(notificationsSchema.recipientUserId, input.recipientUserId),
      ),
    )
    .limit(1);

  if (!notification) {
    return null;
  }

  return {
    ...notification,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}
