import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationDatabaseSubscriber } from './NotificationDatabaseSubscriber';

const state = vi.hoisted(() => {
  type ClientListener = (...args: unknown[]) => void;
  type TestClient = {
    emit: (event: string) => void;
    off: ReturnType<typeof vi.fn<(event: string, listener: ClientListener) => void>>;
    on: ReturnType<typeof vi.fn<(event: string, listener: ClientListener) => void>>;
    query: ReturnType<typeof vi.fn<() => Promise<{ rows: never[] }>>>;
    release: ReturnType<typeof vi.fn<(destroy?: boolean) => void>>;
  };
  const clients: TestClient[] = [];
  const connect = vi.fn<() => Promise<TestClient>>(async () => {
    await Promise.resolve();
    const listeners = new Map<string, ClientListener>();
    const client = {
      emit(event: string) {
        listeners.get(event)?.();
      },
      off: vi.fn<(event: string, listener: ClientListener) => void>((event, listener) => {
        if (listeners.get(event) === listener) {
          listeners.delete(event);
        }
      }),
      on: vi.fn<(event: string, listener: ClientListener) => void>((event, listener) => {
        listeners.set(event, listener);
      }),
      query: vi.fn<() => Promise<{ rows: never[] }>>(async () => {
        await Promise.resolve();
        return { rows: [] };
      }),
      release: vi.fn<(destroy?: boolean) => void>(),
    };
    clients.push(client);
    return client;
  });
  return { clients, connect };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial pool mock isolates subscriber lifecycle.
vi.mock('@/libs/DB', () => ({ db: { $client: { connect: state.connect } } }));
vi.mock(import('./GetNotifications'), () => ({
  getUnreadNotificationCountForUser: vi.fn<() => Promise<number>>(),
}));
vi.mock(import('./NotificationRealtimeQueries'), () => ({
  getRealtimeNotification: vi.fn<() => Promise<null>>(),
}));

describe(NotificationDatabaseSubscriber, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.clients.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('reconnects after clean connection end', async () => {
    const subscriber = new NotificationDatabaseSubscriber();
    await subscriber.start();

    state.clients[0]?.emit('end');
    await vi.advanceTimersByTimeAsync(1000);

    expect(state.connect).toHaveBeenCalledTimes(2);
    expect(state.clients[0]?.release).toHaveBeenCalledWith(true);
  });
});
