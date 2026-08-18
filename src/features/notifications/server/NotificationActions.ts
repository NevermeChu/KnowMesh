'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { notificationMutationSchema } from '@/features/notifications/NotificationSchema';
import type { NotificationMutationInput } from '@/features/notifications/NotificationSchema';
import { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

function revalidateNotifications() {
  revalidatePath('/(workspace)', 'layout');
  revalidatePath('/notifications');
}

export async function markNotificationRead(input: NotificationMutationInput) {
  const { id: userId } = await requireUser();
  const notificationInput = notificationMutationSchema.parse(input);
  const [notification] = await db
    .update(notificationsSchema)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsSchema.id, notificationInput.notificationId),
        eq(notificationsSchema.recipientUserId, userId),
        isNull(notificationsSchema.readAt),
      ),
    )
    .returning({ id: notificationsSchema.id });

  if (!notification) {
    throw new Error('未读通知不存在');
  }

  revalidateNotifications();
}

export async function markAllNotificationsRead() {
  const { id: userId } = await requireUser();
  await db
    .update(notificationsSchema)
    .set({ readAt: new Date() })
    .where(
      and(eq(notificationsSchema.recipientUserId, userId), isNull(notificationsSchema.readAt)),
    );

  revalidateNotifications();
}
