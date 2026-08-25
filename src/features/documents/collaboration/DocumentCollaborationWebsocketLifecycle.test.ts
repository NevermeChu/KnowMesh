import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDocumentCollaborationWebsocket } from './DocumentCollaborationWebsocketLifecycle';

describe('document collaboration websocket lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels discarded Strict Mode connections before opening sockets', async () => {
    vi.useFakeTimers();
    const discarded = {
      create: vi.fn<() => { connect: () => Promise<unknown>; destroy: () => void }>(),
      onReady:
        vi.fn<(websocket: { connect: () => Promise<unknown>; destroy: () => void }) => void>(),
    };
    const discard = startDocumentCollaborationWebsocket(discarded);
    discard();
    await vi.runAllTimersAsync();

    expect(discarded.create).not.toHaveBeenCalled();
    expect(discarded.onReady).not.toHaveBeenCalled();
  });

  it('connects stable transports once and destroys them after cleanup', async () => {
    vi.useFakeTimers();
    const websocket = {
      connect: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
      destroy: vi.fn<() => void>(),
    };
    const lifecycle = {
      create: vi
        .fn<() => { connect: () => Promise<unknown>; destroy: () => void }>()
        .mockReturnValue(websocket),
      onReady:
        vi.fn<(websocket: { connect: () => Promise<unknown>; destroy: () => void }) => void>(),
    };

    const cleanup = startDocumentCollaborationWebsocket(lifecycle);
    await vi.runAllTimersAsync();

    expect(lifecycle.create).toHaveBeenCalledOnce();
    expect(lifecycle.onReady).toHaveBeenCalledWith(websocket);
    expect(websocket.connect).toHaveBeenCalledOnce();

    cleanup();
    await vi.runAllTimersAsync();
    expect(websocket.destroy).toHaveBeenCalledOnce();
  });
});
