import * as z from 'zod';
import { notificationTargetKinds } from './Notification';

export const notificationMutationSchema = z.object({
  notificationId: z.uuid(),
});

export const openNotificationResourceSchema = z.object({
  targetId: z.uuid(),
  targetKind: z.enum(notificationTargetKinds),
});

export type NotificationMutationInput = z.infer<typeof notificationMutationSchema>;
export type OpenNotificationResourceInput = z.infer<typeof openNotificationResourceSchema>;
