'use client';

import { createContext, useContext, useEffect, useEffectEvent, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { NotificationItem, NotificationType } from '@/features/notifications/Notification';

type RealtimeNotificationContextValue = {
  clearUnread: () => void;
  decrementUnread: () => void;
  latestNotification: NotificationItem | null;
  unreadCount: number;
};

const RealtimeNotificationContext = createContext<RealtimeNotificationContextValue | null>(null);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isNotificationPayload(data: unknown): data is {
  notification?: {
    body: string;
    createdAt: string;
    id: string;
    targetId: string | null;
    targetKind: 'project' | 'workspace' | null;
    title: string;
    type: NotificationType;
  };
  unreadCount?: number;
} {
  return typeof data === 'object' && data !== null;
}

function isCountSyncPayload(data: unknown): data is { unreadCount?: number } {
  return typeof data === 'object' && data !== null;
}

/**
 * Provides real-time notification state and maintains a persistent SSE connection.
 *
 * @param props - Initial count from SSR and child nodes.
 * @returns The Realtime notification provider.
 */
export function RealtimeNotificationProvider(props: {
  children: React.ReactNode;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(props.initialUnreadCount);
  const [latestNotification, setLatestNotification] = useState<NotificationItem | null>(null);
  const toast = useToast();
  const showNotificationToast = useEffectEvent((item: NotificationItem) => {
    toast.info(`${item.title}：${item.body}`);
  });

  useEffect(() => {
    setUnreadCount(props.initialUnreadCount);
  }, [props.initialUnreadCount]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const handleNewNotification = (event: MessageEvent<string>) => {
      const parsed = parseJson(event.data);
      if (!isNotificationPayload(parsed)) {
        return;
      }

      if (typeof parsed.unreadCount === 'number') {
        setUnreadCount(parsed.unreadCount);
      } else {
        setUnreadCount((current) => current + 1);
      }

      if (parsed.notification) {
        const item: NotificationItem = {
          body: parsed.notification.body,
          createdAt: new Date(parsed.notification.createdAt),
          id: parsed.notification.id,
          readAt: null,
          targetId: parsed.notification.targetId,
          targetKind: parsed.notification.targetKind,
          title: parsed.notification.title,
          type: parsed.notification.type,
        };
        setLatestNotification(item);
        showNotificationToast(item);
      }
    };

    const handleCountSync = (event: MessageEvent<string>) => {
      const parsed = parseJson(event.data);
      if (!isCountSyncPayload(parsed)) {
        return;
      }

      if (typeof parsed.unreadCount === 'number') {
        setUnreadCount(parsed.unreadCount);
      }
    };

    const connect = () => {
      if (stopped) {
        return;
      }

      eventSource = new EventSource('/api/realtime/notifications');
      eventSource.addEventListener('notification:new', handleNewNotification);
      eventSource.addEventListener('notification:count_sync', handleCountSync);
      eventSource.addEventListener('open', () => {
        reconnectAttempt = 0;
      });
      eventSource.addEventListener('error', () => {
        if (!eventSource || eventSource.readyState !== EventSource.CLOSED || reconnectTimer) {
          return;
        }

        eventSource.close();
        eventSource = null;
        const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, delay);
      });
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (eventSource) {
        eventSource.removeEventListener('notification:new', handleNewNotification);
        eventSource.removeEventListener('notification:count_sync', handleCountSync);
        eventSource.close();
        eventSource = null;
      }
    };
  }, []);

  const contextValue: RealtimeNotificationContextValue = {
    clearUnread: () => {
      setUnreadCount(0);
    },
    decrementUnread: () => {
      setUnreadCount((current) => Math.max(0, current - 1));
    },
    latestNotification,
    unreadCount,
  };

  return (
    <RealtimeNotificationContext value={contextValue}>{props.children}</RealtimeNotificationContext>
  );
}

/**
 * Hook to access the live unread notification count.
 *
 * @returns The current unread notification count.
 */
export function useRealtimeUnreadCount() {
  const context = useContext(RealtimeNotificationContext);
  return context?.unreadCount ?? 0;
}
