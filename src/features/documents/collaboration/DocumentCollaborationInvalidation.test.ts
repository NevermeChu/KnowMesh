import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentCollaborationInvalidationSubscriber } from './DocumentCollaborationInvalidation';

const state = vi.hoisted(() => {
  type ClientListener = (...args: unknown[]) => void;
  type TestClient = {
    emit: (event: string, ...args: unknown[]) => void;
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
      emit(event: string, ...args: unknown[]) {
        listeners.get(event)?.(...args);
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

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial pool mock isolates subscriber lifecycle.
vi.mock('@/libs/DB', () => ({ db: { $client: { connect: state.connect } } }));

describe(DocumentCollaborationInvalidationSubscriber, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.clients.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects after clean connection end', async () => {
    const subscriber = new DocumentCollaborationInvalidationSubscriber(vi.fn<() => void>());
    await subscriber.start();

    state.clients[0]?.emit('end');
    await vi.advanceTimersByTimeAsync(1000);

    expect(state.connect).toHaveBeenCalledTimes(2);
    expect(state.clients[0]?.release).toHaveBeenCalledWith(true);
    subscriber.stop();
  });

  it('dispatches document title invalidations', async () => {
    const invalidate = vi.fn<() => void>();
    const subscriber = new DocumentCollaborationInvalidationSubscriber(invalidate);
    await subscriber.start();

    state.clients[0]?.emit('notification', {
      channel: 'knowmesh_document_collaboration',
      payload: JSON.stringify({
        documentId: '30000000-0000-4000-8000-000000000001',
        kind: 'document_title',
        title: '远端标题',
        titleVersion: 2,
      }),
      processId: 1,
    });

    await vi.waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        documentId: '30000000-0000-4000-8000-000000000001',
        kind: 'document_title',
        title: '远端标题',
        titleVersion: 2,
      });
    });
    subscriber.stop();
  });
});
