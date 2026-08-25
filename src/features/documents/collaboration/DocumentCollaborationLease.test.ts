import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireDocumentCollaborationLease } from './DocumentCollaborationLease';

const state = vi.hoisted(() => {
  type ClientListener = (error?: Error) => void;
  const listeners = new Map<string, ClientListener>();
  const off = vi.fn<(event: string, listener: ClientListener) => void>((event, listener) => {
    if (listeners.get(event) === listener) {
      listeners.delete(event);
    }
  });
  const on = vi.fn<(event: string, listener: ClientListener) => void>((event, listener) => {
    listeners.set(event, listener);
  });
  const query = vi.fn<() => Promise<{ rows: { acquired?: boolean; released?: boolean }[] }>>();
  const release = vi.fn<(destroy?: boolean) => void>();
  const connect = vi.fn<
    () => Promise<{ off: typeof off; on: typeof on; query: typeof query; release: typeof release }>
  >(async () => {
    await Promise.resolve();
    return { off, on, query, release };
  });
  return { connect, listeners, off, on, query, release };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial pool mock isolates the advisory-lock lease.
vi.mock('@/libs/DB', () => ({ db: { $client: { connect: state.connect } } }));

describe(acquireDocumentCollaborationLease, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.listeners.clear();
  });

  it('holds and releases singleton advisory lock', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ released: true }] });

    const lease = await acquireDocumentCollaborationLease({
      onLost: vi.fn<(error: Error) => void>(),
    });
    await lease.release();

    expect(state.query).toHaveBeenCalledTimes(2);
    expect(state.release).toHaveBeenCalledWith();
  });

  it('rejects startup while another instance owns lease', async () => {
    state.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });

    await expect(
      acquireDocumentCollaborationLease({ onLost: vi.fn<(error: Error) => void>() }),
    ).rejects.toThrow('已有协作服务实例持有数据库租约');
    expect(state.release).toHaveBeenCalledWith(true);
  });

  it('reports a clean lease connection end', async () => {
    state.query.mockResolvedValueOnce({ rows: [{ acquired: true }] });
    const onLost = vi.fn<(error: Error) => void>();

    await acquireDocumentCollaborationLease({ onLost });
    state.listeners.get('end')?.();

    expect(onLost).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});
