import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedSession } from '@/features/auth/server/CurrentUser';
import { notificationBroadcaster } from '@/features/notifications/server/NotificationBroadcaster';
import { GET } from './route';

const state = vi.hoisted(() => {
  const requireAuthenticatedSession = vi.fn<() => Promise<AuthenticatedSession>>();
  const getUnreadNotificationCountForUser = vi.fn<() => Promise<number>>();
  const isSessionActive = vi.fn<() => Promise<boolean>>();
  const start = vi.fn<() => Promise<void>>();
  return { getUnreadNotificationCountForUser, isSessionActive, requireAuthenticatedSession, start };
});

const authenticatedSession: AuthenticatedSession = {
  sessionId: 'session-1',
  user: {
    email: 'user@example.com',
    emailVerified: true,
    id: 'user-1',
    image: null,
    name: 'User',
  },
};

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/features/auth/server/CurrentUser'), () => ({
  requireAuthenticatedSession: state.requireAuthenticatedSession,
}));
vi.mock(import('@/features/auth/server/SessionAuthorization'), () => ({
  isSessionActive: state.isSessionActive,
}));
vi.mock(import('@/features/notifications/server/GetNotifications'), () => ({
  getUnreadNotificationCountForUser: state.getUnreadNotificationCountForUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial subscriber mock avoids opening a database listener.
vi.mock('@/features/notifications/server/NotificationDatabaseSubscriber', () => ({
  notificationDatabaseSubscriber: { start: state.start },
}));

describe(GET, () => {
  it('returns 401 Unauthorized when user is not authenticated', async () => {
    state.requireAuthenticatedSession.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns 200 OK text/event-stream response for authenticated user', async () => {
    state.start.mockResolvedValueOnce();
    state.getUnreadNotificationCountForUser.mockResolvedValueOnce(3);
    state.requireAuthenticatedSession.mockResolvedValueOnce(authenticatedSession);

    const response = await GET();

    expect(response.status).toBe(200);
    expect({
      cacheControl: response.headers.get('Cache-Control'),
      contentType: response.headers.get('Content-Type'),
      proxyBuffering: response.headers.get('X-Accel-Buffering'),
    }).toStrictEqual({
      cacheControl: 'no-cache, no-transform',
      contentType: 'text/event-stream; charset=utf-8',
      proxyBuffering: 'no',
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Reader expected to be defined');
    }

    const { value } = await reader.read();
    const decoded = new TextDecoder().decode(value);
    expect(decoded).toContain(': connected');
    const countChunk = await reader.read();
    expect(new TextDecoder().decode(countChunk.value)).toContain('"unreadCount":3');
    await reader.cancel();
  });

  it('receives published events through the stream', async () => {
    state.start.mockResolvedValueOnce();
    state.getUnreadNotificationCountForUser.mockResolvedValueOnce(0);
    state.requireAuthenticatedSession.mockResolvedValueOnce({
      ...authenticatedSession,
      user: { ...authenticatedSession.user, id: 'user-stream-test' },
    });

    const response = await GET();
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Reader expected to be defined');
    }

    // Consume initial ': connected' chunk
    await reader.read();
    // Consume initial persisted count synchronization
    await reader.read();

    // Publish an event
    notificationBroadcaster.publish('user-stream-test', {
      payload: { unreadCount: 5 },
      type: 'notification:count_sync',
    });

    const { value } = await reader.read();
    const decoded = new TextDecoder().decode(value);
    expect(decoded).toContain('event: notification:count_sync');
    expect(decoded).toContain('"unreadCount":5');

    await reader.cancel();
  });

  it('closes stream after session revocation', async () => {
    vi.useFakeTimers();
    try {
      state.start.mockResolvedValueOnce();
      state.getUnreadNotificationCountForUser.mockResolvedValueOnce(0);
      state.requireAuthenticatedSession.mockResolvedValueOnce(authenticatedSession);
      state.isSessionActive.mockResolvedValueOnce(false);

      const response = await GET();
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Reader expected to be defined');
      }
      await reader.read();
      await reader.read();

      await vi.advanceTimersByTimeAsync(15_000);

      await expect(reader.read()).resolves.toMatchObject({ done: true });
      expect(state.isSessionActive).toHaveBeenCalledWith({
        sessionId: 'session-1',
        userId: 'user-1',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
