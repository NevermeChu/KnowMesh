import 'server-only';
import { requireAuthenticatedSession } from '@/features/auth/server/CurrentUser';
import { isSessionActive } from '@/features/auth/server/SessionAuthorization';
import { getUnreadNotificationCountForUser } from '@/features/notifications/server/GetNotifications';
import { notificationBroadcaster } from '@/features/notifications/server/NotificationBroadcaster';
import { notificationDatabaseSubscriber } from '@/features/notifications/server/NotificationDatabaseSubscriber';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_REVALIDATION_MS = 15_000;
const SSE_HIGH_WATER_MARK = 8;

/**
 * Handles incoming Server-Sent Events (SSE) subscriptions for user notifications.
 *
 * @returns An event stream response transmitting real-time notification events.
 */
export async function GET() {
  let authenticatedSession;
  try {
    authenticatedSession = await requireAuthenticatedSession();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let revalidationTimer: NodeJS.Timeout | undefined;
  let revalidationRunning = false;
  let streamClosed = false;

  const cleanup = () => {
    streamClosed = true;
    unsubscribe?.();
    unsubscribe = undefined;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
    if (revalidationTimer) {
      clearInterval(revalidationTimer);
      revalidationTimer = undefined;
    }
  };

  const enqueue = (controller: ReadableStreamDefaultController<Uint8Array>, payload: string) => {
    if (streamClosed) {
      return false;
    }

    if (controller.desiredSize !== null && controller.desiredSize <= 0) {
      cleanup();
      controller.close();
      return false;
    }

    try {
      controller.enqueue(encoder.encode(payload));
      return true;
    } catch {
      cleanup();
      return false;
    }
  };

  const stream = new ReadableStream<Uint8Array>(
    {
      async start(controller) {
        // 1. Initial connection confirmation
        enqueue(controller, ': connected\n\n');

        // 2. Start the cross-process database listener before subscribing locally.
        await notificationDatabaseSubscriber.start();
        unsubscribe = notificationBroadcaster.subscribe(authenticatedSession.user.id, (event) => {
          const payloadString = JSON.stringify(event.payload);
          enqueue(controller, `event: ${event.type}\ndata: ${payloadString}\n\n`);
        });

        // 3. Reconcile persistent state on every initial connection and browser reconnect.
        const unreadCount = await getUnreadNotificationCountForUser(authenticatedSession.user.id);
        enqueue(
          controller,
          `event: notification:count_sync\ndata: ${JSON.stringify({ unreadCount })}\n\n`,
        );

        // 4. Keep-alive heartbeat every 25 seconds
        heartbeatTimer = setInterval(() => {
          enqueue(controller, `event: ping\ndata: "${Date.now()}"\n\n`);
        }, 25_000);

        revalidationTimer = setInterval(() => {
          if (revalidationRunning || streamClosed) {
            return;
          }

          revalidationRunning = true;
          void (async () => {
            try {
              const active = await isSessionActive({
                sessionId: authenticatedSession.sessionId,
                userId: authenticatedSession.user.id,
              });
              if (!active && !streamClosed) {
                cleanup();
                controller.close();
              }
            } catch (error) {
              console.error('Notification session revalidation failed:', error);
            } finally {
              revalidationRunning = false;
            }
          })();
        }, SESSION_REVALIDATION_MS);
      },
      cancel() {
        cleanup();
      },
    },
    { highWaterMark: SSE_HIGH_WATER_MARK },
  );

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  });
}
