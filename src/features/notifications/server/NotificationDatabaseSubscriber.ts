import 'server-only';
import type { Notification, PoolClient } from 'pg';
import * as z from 'zod';
import { db } from '@/libs/DB';
import { getUnreadNotificationCountForUser } from './GetNotifications';
import { notificationBroadcaster } from './NotificationBroadcaster';
import { getRealtimeNotification } from './NotificationRealtimeQueries';

const NOTIFICATION_CHANNEL = 'knowmesh_notifications';
const RETRY_DELAY_MS = 1000;

const notificationSignalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('count'),
    recipientUserId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('new'),
    notificationId: z.uuid(),
    recipientUserId: z.string().min(1),
  }),
]);

function parseSignal(payload: string) {
  try {
    return notificationSignalSchema.safeParse(JSON.parse(payload));
  } catch {
    return null;
  }
}

declare global {
  var __knowmesh_notification_database_subscriber: NotificationDatabaseSubscriber | undefined;
}

/**
 * Bridges transactional PostgreSQL notifications into the process-local SSE broadcaster.
 */
export class NotificationDatabaseSubscriber {
  private client: PoolClient | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private startPromise: Promise<void> | null = null;

  /**
   * Starts the shared database listener once for the current application process.
   *
   * @returns When the PostgreSQL listener is ready.
   */
  async start() {
    this.startPromise ??= this.connect();
    try {
      await this.startPromise;
    } catch (error) {
      this.resetConnection();
      throw error;
    }
  }

  private async connect() {
    const client = await db.$client.connect();
    this.client = client;
    client.on('error', this.handleConnectionError);
    client.on('notification', NotificationDatabaseSubscriber.handleNotification);
    await client.query(`LISTEN ${NOTIFICATION_CHANNEL}`);
  }

  private readonly handleConnectionError = () => {
    this.resetConnection();
    this.retryTimer ??= setTimeout(() => {
      this.retryTimer = null;
      void this.restart();
    }, RETRY_DELAY_MS);
  };

  private static readonly handleNotification = (message: Notification) => {
    if (message.channel !== NOTIFICATION_CHANNEL || !message.payload) {
      return;
    }

    void NotificationDatabaseSubscriber.dispatchSafely(message.payload);
  };

  private static async dispatch(payload: string) {
    const parsedPayload = parseSignal(payload);
    if (!parsedPayload?.success) {
      return;
    }

    const unreadCount = await getUnreadNotificationCountForUser(parsedPayload.data.recipientUserId);

    if (parsedPayload.data.kind === 'new') {
      const notification = await getRealtimeNotification({
        notificationId: parsedPayload.data.notificationId,
        recipientUserId: parsedPayload.data.recipientUserId,
      });

      if (notification) {
        notificationBroadcaster.publish(parsedPayload.data.recipientUserId, {
          payload: { notification, unreadCount },
          type: 'notification:new',
        });
        return;
      }
    }

    notificationBroadcaster.publish(parsedPayload.data.recipientUserId, {
      payload: { unreadCount },
      type: 'notification:count_sync',
    });
  }

  private static async dispatchSafely(payload: string) {
    try {
      await NotificationDatabaseSubscriber.dispatch(payload);
    } catch (error) {
      console.error('Notification database signal dispatch failed:', error);
    }
  }

  private async restart() {
    try {
      await this.start();
    } catch {
      this.handleConnectionError();
    }
  }

  private resetConnection() {
    if (this.client) {
      this.client.off('error', this.handleConnectionError);
      this.client.off('notification', NotificationDatabaseSubscriber.handleNotification);
      this.client.release(true);
      this.client = null;
    }
    this.startPromise = null;
  }
}

export const notificationDatabaseSubscriber =
  (globalThis.__knowmesh_notification_database_subscriber ??= new NotificationDatabaseSubscriber());
