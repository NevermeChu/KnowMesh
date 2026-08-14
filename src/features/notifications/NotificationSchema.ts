import * as z from 'zod';

export const notificationMutationSchema = z.object({
  notificationId: z.uuid(),
});

export type NotificationMutationInput = z.infer<typeof notificationMutationSchema>;
