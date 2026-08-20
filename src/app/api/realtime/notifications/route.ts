import 'server-only';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { getUnreadNotificationCountForUser } from '@/features/notifications/server/GetNotifications';
import { notificationBroadcaster } from '@/features/notifications/server/NotificationBroadcaster';
import { notificationDatabaseSubscriber } from '@/features/notifications/server/NotificationDatabaseSubscriber';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Handles incoming Server-Sent Events (SSE) subscriptions for user notifications.
 *
 * @returns An event stream response transmitting real-time notification events.
 */
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Initial connection confirmation
      controller.enqueue(encoder.encode(': connected\n\n'));

      // 2. Start the cross-process database listener before subscribing locally.
      await notificationDatabaseSubscriber.start();
      unsubscribe = notificationBroadcaster.subscribe(user.id, (event) => {
        try {
          const payloadString = JSON.stringify(event.payload);
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${payloadString}\n\n`));
        } catch {
          // Stream might be closed
        }
      });

      // 3. Reconcile persistent state on every initial connection and browser reconnect.
      const unreadCount = await getUnreadNotificationCountForUser(user.id);
      controller.enqueue(
        encoder.encode(
          `event: notification:count_sync\ndata: ${JSON.stringify({ unreadCount })}\n\n`,
        ),
      );

      // 4. Keep-alive heartbeat every 25 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: "${Date.now()}"\n\n`));
        } catch {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
          }
        }
      }, 25_000);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  });
}
