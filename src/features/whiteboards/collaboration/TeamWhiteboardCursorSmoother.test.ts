import { describe, expect, it, vi } from 'vitest';
import {
  TeamWhiteboardCursorSmoother,
  WHITEBOARD_CURSOR_SMOOTHING_MS,
} from './TeamWhiteboardCursorSmoother';
import type { SmoothedWhiteboardCursor } from './TeamWhiteboardCursorSmoother';

const cursor = (options: {
  button?: 'down' | 'up';
  connectionId?: string;
  sequence: number;
  x: number;
}) => ({
  button: options.button ?? ('up' as const),
  clientSequence: options.sequence,
  connectionId: options.connectionId ?? 'connection-1',
  tool: 'pointer' as const,
  x: options.x,
  y: options.x,
});

describe(TeamWhiteboardCursorSmoother, () => {
  it('renders the first target immediately', () => {
    const publish = vi.fn<(updates: SmoothedWhiteboardCursor[]) => void>();
    const smoother = new TeamWhiteboardCursorSmoother({
      now: () => 0,
      publish,
      requestFrame: vi.fn<(callback: FrameRequestCallback) => number>(() => 1),
    });

    smoother.push(cursor({ sequence: 0, x: 10 }));

    expect(publish).toHaveBeenCalledWith([
      {
        button: 'up',
        connectionId: 'connection-1',
        tool: 'pointer',
        x: 10,
        y: 10,
      },
    ]);
    smoother.dispose();
  });

  it('interpolates the latest target over animation frames', () => {
    let now = 0;
    let frame: FrameRequestCallback | undefined;
    const publish = vi.fn<(updates: SmoothedWhiteboardCursor[]) => void>();
    const smoother = new TeamWhiteboardCursorSmoother({
      cancelFrame: vi.fn<(frameId: number) => void>(),
      now: () => now,
      publish,
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- requestAnimationFrame defines this callback API.
      requestFrame: (callback) => {
        frame = callback;
        return 1;
      },
    });
    smoother.push(cursor({ sequence: 0, x: 0 }));
    now = 33;
    smoother.push(cursor({ sequence: 1, x: 100 }));

    frame?.(33 + WHITEBOARD_CURSOR_SMOOTHING_MS / 2);
    const intermediate = publish.mock.calls.at(-1)?.[0][0];
    if (!intermediate) {
      throw new Error('Expected an interpolated cursor frame');
    }
    expect(intermediate.x).toBeGreaterThan(0);
    expect(intermediate.x).toBeLessThan(100);

    frame?.(33 + WHITEBOARD_CURSOR_SMOOTHING_MS);
    expect(publish).toHaveBeenLastCalledWith([
      {
        button: 'up',
        connectionId: 'connection-1',
        tool: 'pointer',
        x: 100,
        y: 100,
      },
    ]);
    smoother.dispose();
  });

  it('shares one scheduled frame across collaborators', () => {
    let now = 0;
    const requestFrame = vi.fn<(callback: FrameRequestCallback) => number>(() => 1);
    const smoother = new TeamWhiteboardCursorSmoother({
      cancelFrame: vi.fn<(frameId: number) => void>(),
      now: () => now,
      publish: vi.fn<(updates: SmoothedWhiteboardCursor[]) => void>(),
      requestFrame,
    });
    smoother.push(cursor({ connectionId: 'connection-1', sequence: 0, x: 0 }));
    smoother.push(cursor({ connectionId: 'connection-2', sequence: 0, x: 0 }));
    now = 33;

    smoother.push(cursor({ connectionId: 'connection-1', sequence: 1, x: 10 }));
    smoother.push(cursor({ connectionId: 'connection-2', sequence: 1, x: 20 }));

    expect(requestFrame).toHaveBeenCalledOnce();
    smoother.dispose();
  });

  it('snaps a completed drag to its reliable final target', () => {
    let now = 0;
    const cancelFrame = vi.fn<(frameId: number) => void>();
    const publish = vi.fn<(updates: SmoothedWhiteboardCursor[]) => void>();
    const smoother = new TeamWhiteboardCursorSmoother({
      cancelFrame,
      now: () => now,
      publish,
      requestFrame: vi.fn<(callback: FrameRequestCallback) => number>(() => 7),
    });
    smoother.push(cursor({ button: 'down', sequence: 0, x: 0 }));
    now = 20;
    smoother.push(cursor({ button: 'down', sequence: 1, x: 50 }));
    now = 30;

    smoother.push(cursor({ button: 'up', sequence: 2, x: 100 }));

    expect(publish).toHaveBeenLastCalledWith([
      {
        button: 'up',
        connectionId: 'connection-1',
        tool: 'pointer',
        x: 100,
        y: 100,
      },
    ]);
    smoother.dispose();
    expect(cancelFrame).toHaveBeenCalledWith(7);
  });
});
