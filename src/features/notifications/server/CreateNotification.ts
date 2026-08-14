import 'server-only';
import type {
  NotificationTargetKind,
  NotificationType,
} from '@/features/notifications/Notification';
import type { db } from '@/libs/DB';
import { notificationsSchema } from '@/models/Schema';

type NotificationWriter = Pick<typeof db, 'insert'>;

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
  await database.insert(notificationsSchema).values({
    actorUserId: input.actorUserId,
    body: input.body,
    recipientUserId: input.recipientUserId,
    targetId: input.target?.id,
    targetKind: input.target?.kind,
    title: input.title,
    type: input.type,
  });
}
