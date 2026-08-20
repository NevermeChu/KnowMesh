import 'server-only';
import { EventEmitter } from 'node:events';
import type { NotificationRealtimeEvent } from '@/features/notifications/Notification';

type NotificationEventListener = (event: NotificationRealtimeEvent) => void;

declare global {
  var __knowmesh_notification_broadcaster: NotificationBroadcaster | undefined;
}

/**
 * Process-local fan-out bus for database-backed user notification signals.
 */
export class NotificationBroadcaster {
  // oxlint-disable-next-line unicorn/prefer-event-target -- Server-only Node event emitter for channel-based notification routing.
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  /**
   * Subscribes to real-time events targeted at a specific user.
   *
   * @param userId - Recipient user identifier.
   * @param listener - Callback receiving the notification event.
   * @returns Cleanup function to unsubscribe the listener.
   */
  subscribe(userId: string, listener: NotificationEventListener): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, listener);

    return () => {
      this.emitter.off(channel, listener);
    };
  }

  /**
   * Publishes a real-time event to a specific user channel.
   *
   * @param userId - Recipient user identifier.
   * @param event - Realtime notification event payload.
   */
  publish(userId: string, event: NotificationRealtimeEvent): void {
    const channel = `user:${userId}`;
    this.emitter.emit(channel, event);
  }
}

export const notificationBroadcaster = (globalThis.__knowmesh_notification_broadcaster ??=
  new NotificationBroadcaster());
