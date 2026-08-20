import { describe, expect, it, vi } from 'vitest';
import type { NotificationRealtimeEvent } from '@/features/notifications/Notification';
import { NotificationBroadcaster } from './NotificationBroadcaster';

vi.mock(import('server-only'), () => ({}));

describe(NotificationBroadcaster, () => {
  describe('subscribe and publish', () => {
    it('dispatches new notification events to target subscriber', () => {
      const broadcaster = new NotificationBroadcaster();
      const receivedEvents: NotificationRealtimeEvent[] = [];

      const unsubscribe = broadcaster.subscribe('user-1', (event) => {
        receivedEvents.push(event);
      });

      const sampleEvent: NotificationRealtimeEvent = {
        payload: {
          notification: {
            body: '张三 邀请你加入工作区。',
            createdAt: new Date().toISOString(),
            id: 'notif-1',
            readAt: null,
            targetId: 'workspace-1',
            targetKind: 'workspace',
            title: '收到工作区邀请',
            type: 'workspace_invited',
          },
        },
        type: 'notification:new',
      };

      broadcaster.publish('user-1', sampleEvent);
      broadcaster.publish('user-2', {
        payload: { unreadCount: 5 },
        type: 'notification:count_sync',
      });

      expect(receivedEvents).toStrictEqual([sampleEvent]);
      unsubscribe();
    });

    it('stops receiving events after unsubscribing', () => {
      const broadcaster = new NotificationBroadcaster();
      const receivedEvents: NotificationRealtimeEvent[] = [];

      const unsubscribe = broadcaster.subscribe('user-1', (event) => {
        receivedEvents.push(event);
      });

      unsubscribe();

      broadcaster.publish('user-1', {
        payload: { unreadCount: 0 },
        type: 'notification:count_sync',
      });

      expect(receivedEvents).toHaveLength(0);
    });
  });
});
