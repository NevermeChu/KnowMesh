import 'server-only';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { cache } from 'react';
import { requireUser } from '@/features/auth/server/CurrentUser';
import type { NotificationItem } from '@/features/notifications/Notification';
import { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

const NOTIFICATION_PAGE_SIZE = 50;

export const getNotifications = cache(async (): Promise<NotificationItem[]> => {
  const { id: userId } = await requireUser();

  return await db
    .select({
      actorUserId: notificationsSchema.actorUserId,
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
    .where(eq(notificationsSchema.recipientUserId, userId))
    .orderBy(desc(notificationsSchema.createdAt), desc(notificationsSchema.id))
    .limit(NOTIFICATION_PAGE_SIZE);
});

/**
 * Counts unread notifications for a trusted server-side user identifier.
 *
 * @param userId - Authenticated notification recipient.
 * @returns Current unread notification count.
 */
export async function getUnreadNotificationCountForUser(userId: string) {
  const [result] = await db
    .select({ value: count() })
    .from(notificationsSchema)
    .where(
      and(eq(notificationsSchema.recipientUserId, userId), isNull(notificationsSchema.readAt)),
    );

  return result?.value ?? 0;
}

export const getUnreadNotificationCount = cache(async () => {
  const { id: userId } = await requireUser();
  return await getUnreadNotificationCountForUser(userId);
});
