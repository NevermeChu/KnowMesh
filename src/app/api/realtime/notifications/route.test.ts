import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/features/auth/server/CurrentUser';
import { notificationBroadcaster } from '@/features/notifications/server/NotificationBroadcaster';
import { GET } from './route';

const state = vi.hoisted(() => {
  const requireUser = vi.fn<() => Promise<AuthenticatedUser>>();
  return { requireUser };
});

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/features/auth/server/CurrentUser'), () => ({ requireUser: state.requireUser }));

describe(GET, () => {
  it('returns 401 Unauthorized when user is not authenticated', async () => {
    state.requireUser.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns 200 OK text/event-stream response for authenticated user', async () => {
    state.requireUser.mockResolvedValueOnce({
      email: 'user@example.com',
      emailVerified: true,
      id: 'user-1',
      image: null,
      name: 'User',
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Reader expected to be defined');
    }

    const { value } = await reader.read();
    const decoded = new TextDecoder().decode(value);
    expect(decoded).toContain(': connected');
    await reader.cancel();
  });

  it('receives published events through the stream', async () => {
    state.requireUser.mockResolvedValueOnce({
      email: 'stream@example.com',
      emailVerified: true,
      id: 'user-stream-test',
      image: null,
      name: 'StreamUser',
    });

    const response = await GET();
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Reader expected to be defined');
    }

    // Consume initial ': connected' chunk
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
});
