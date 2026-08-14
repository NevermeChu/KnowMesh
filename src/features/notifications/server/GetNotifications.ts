import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { NotificationItem } from '@/features/notifications/Notification';
import { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

const NOTIFICATION_PAGE_SIZE = 50;

export async function getNotifications(): Promise<NotificationItem[]> {
  const { userId } = await auth.protect();

  return await db
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
    .where(eq(notificationsSchema.recipientUserId, userId))
    .orderBy(desc(notificationsSchema.createdAt), desc(notificationsSchema.id))
    .limit(NOTIFICATION_PAGE_SIZE);
}

export async function getUnreadNotificationCount() {
  const { userId } = await auth.protect();
  const [result] = await db
    .select({ value: count() })
    .from(notificationsSchema)
    .where(
      and(eq(notificationsSchema.recipientUserId, userId), isNull(notificationsSchema.readAt)),
    );

  return result?.value ?? 0;
}
