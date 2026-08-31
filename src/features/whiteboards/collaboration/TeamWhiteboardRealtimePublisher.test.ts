import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_WHITEBOARD_SCENE } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';
import { TeamWhiteboardRealtimePublisher } from './TeamWhiteboardRealtimePublisher';

const rectangle = (version: number) => ({
  height: 100,
  id: 'rectangle',
  isDeleted: false,
  type: 'rectangle',
  version,
  versionNonce: version,
  width: 100,
  x: 0,
  y: 0,
});

const sceneWith = (elements: WhiteboardScene['elements']): WhiteboardScene => ({
  ...EMPTY_WHITEBOARD_SCENE,
  elements,
});

describe(TeamWhiteboardRealtimePublisher, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes only elements changed since the baseline', () => {
    vi.useFakeTimers();
    const publishScene = vi.fn<(update: unknown) => void>();
    const publisher = new TeamWhiteboardRealtimePublisher({
      initialScene: sceneWith([rectangle(1)]),
      publishCursor: vi.fn<(pointer: unknown, volatile: boolean) => void>(),
      publishScene,
    });

    publisher.enqueueScene(sceneWith([rectangle(2)]));

    expect(publishScene).toHaveBeenCalledWith({
      clientSequence: 0,
      scene: sceneWith([rectangle(2)]),
    });
    publisher.dispose();
  });

  it('coalesces scene changes into the latest realtime frame', () => {
    vi.useFakeTimers();
    const publishScene = vi.fn<(update: unknown) => void>();
    const publisher = new TeamWhiteboardRealtimePublisher({
      initialScene: EMPTY_WHITEBOARD_SCENE,
      publishCursor: vi.fn<(pointer: unknown, volatile: boolean) => void>(),
      publishScene,
    });

    publisher.enqueueScene(sceneWith([rectangle(1)]));
    publisher.enqueueScene(sceneWith([rectangle(2)]));
    publisher.enqueueScene(sceneWith([rectangle(3)]));
    vi.runOnlyPendingTimers();

    expect(publishScene).toHaveBeenCalledTimes(2);
    expect(publishScene).toHaveBeenLastCalledWith({
      clientSequence: 1,
      scene: sceneWith([rectangle(3)]),
    });
    publisher.dispose();
  });

  it('drops queued cursor samples when a reliable final position is flushed', () => {
    vi.useFakeTimers();
    const publishCursor = vi.fn<(pointer: unknown, volatile: boolean) => void>();
    const publisher = new TeamWhiteboardRealtimePublisher({
      initialScene: EMPTY_WHITEBOARD_SCENE,
      publishCursor,
      publishScene: vi.fn<(update: unknown) => void>(),
    });

    publisher.enqueueCursor({ button: 'down', tool: 'pointer', x: 1, y: 1 });
    publisher.enqueueCursor({ button: 'down', tool: 'pointer', x: 2, y: 2 });
    publisher.enqueueCursor({ button: 'up', tool: 'pointer', x: 3, y: 3 });
    vi.runAllTimers();

    expect(publishCursor).toHaveBeenCalledTimes(2);
    expect(publishCursor).toHaveBeenNthCalledWith(
      1,
      { button: 'down', clientSequence: 0, tool: 'pointer', x: 1, y: 1 },
      true,
    );
    expect(publishCursor).toHaveBeenNthCalledWith(
      2,
      { button: 'up', clientSequence: 1, tool: 'pointer', x: 3, y: 3 },
      false,
    );
    publisher.dispose();
  });
});
