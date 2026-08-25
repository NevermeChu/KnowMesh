import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import type { NotificationType } from '@/features/notifications/Notification';
import type { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

type NotificationUpdater = Pick<typeof db, 'update'>;

/**
 * Marks unread notifications for one resource interaction as read.
 *
 * @param database - Database client or active transaction.
 * @param options - Recipient, resource, event type and optional actor filter.
 */
export async function markRelatedNotificationsRead(
  database: NotificationUpdater,
  options: {
    actorUserId?: string;
    readAt?: Date;
    recipientUserId: string;
    targetId: string;
    type: NotificationType;
  },
) {
  await database
    .update(notificationsSchema)
    .set({ readAt: options.readAt ?? new Date() })
    .where(
      and(
        eq(notificationsSchema.recipientUserId, options.recipientUserId),
        options.actorUserId ? eq(notificationsSchema.actorUserId, options.actorUserId) : undefined,
        eq(notificationsSchema.targetId, options.targetId),
        eq(notificationsSchema.type, options.type),
        isNull(notificationsSchema.readAt),
      ),
    );
}
