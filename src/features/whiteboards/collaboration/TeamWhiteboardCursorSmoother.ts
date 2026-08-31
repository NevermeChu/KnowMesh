import type { WhiteboardCursorUpdate } from './WhiteboardCollaborationProtocol';

export const WHITEBOARD_CURSOR_SMOOTHING_MS = 50;

export type SmoothedWhiteboardCursor = Pick<
  WhiteboardCursorUpdate,
  'button' | 'connectionId' | 'tool' | 'x' | 'y'
>;

type CursorState = SmoothedWhiteboardCursor & {
  currentX: number;
  currentY: number;
  startedAt: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
};

const toSmoothedCursor = (state: CursorState): SmoothedWhiteboardCursor => ({
  button: state.button,
  connectionId: state.connectionId,
  tool: state.tool,
  x: state.currentX,
  y: state.currentY,
});

const isMoving = (state: CursorState) =>
  state.currentX !== state.targetX || state.currentY !== state.targetY;

/** Smooths low-frequency remote cursor targets with one shared animation loop. */
export class TeamWhiteboardCursorSmoother {
  private frameId: number | null = null;
  private readonly options: {
    cancelFrame?: (frameId: number) => void;
    now?: () => number;
    publish: (updates: SmoothedWhiteboardCursor[]) => void;
    requestFrame?: (callback: FrameRequestCallback) => number;
  };
  private readonly states = new Map<string, CursorState>();

  constructor(options: TeamWhiteboardCursorSmoother['options']) {
    this.options = options;
  }

  clear() {
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }
    this.states.clear();
  }

  dispose() {
    this.clear();
  }

  push(cursor: WhiteboardCursorUpdate) {
    const previous = this.states.get(cursor.connectionId);
    const now = this.now();
    if (!previous) {
      const state: CursorState = {
        ...cursor,
        currentX: cursor.x,
        currentY: cursor.y,
        startedAt: now,
        startX: cursor.x,
        startY: cursor.y,
        targetX: cursor.x,
        targetY: cursor.y,
      };
      this.states.set(cursor.connectionId, state);
      this.options.publish([toSmoothedCursor(state)]);
      return;
    }

    const completesDrag = previous.button === 'down' && cursor.button === 'up';
    if (completesDrag) {
      const state: CursorState = {
        ...previous,
        ...cursor,
        currentX: cursor.x,
        currentY: cursor.y,
        startedAt: now,
        startX: cursor.x,
        startY: cursor.y,
        targetX: cursor.x,
        targetY: cursor.y,
      };
      this.states.set(cursor.connectionId, state);
      this.options.publish([toSmoothedCursor(state)]);
      return;
    }

    const state: CursorState = {
      ...previous,
      ...cursor,
      startedAt: now,
      startX: previous.currentX,
      startY: previous.currentY,
      targetX: cursor.x,
      targetY: cursor.y,
    };
    this.states.set(cursor.connectionId, state);
    if (!isMoving(state)) {
      if (previous.button !== cursor.button || previous.tool !== cursor.tool) {
        this.options.publish([toSmoothedCursor(state)]);
      }
      return;
    }
    this.scheduleFrame();
  }

  retainConnections(connectionIds: Set<string>) {
    for (const connectionId of this.states.keys()) {
      if (!connectionIds.has(connectionId)) {
        this.states.delete(connectionId);
      }
    }
    if (this.states.size === 0 && this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }
  }

  private readonly animate = (timestamp: number) => {
    this.frameId = null;
    const updates: SmoothedWhiteboardCursor[] = [];
    let hasMovingCursor = false;
    for (const state of this.states.values()) {
      if (!isMoving(state)) {
        continue;
      }
      const progress = Math.min(
        1,
        Math.max(0, (timestamp - state.startedAt) / WHITEBOARD_CURSOR_SMOOTHING_MS),
      );
      const easedProgress = 1 - (1 - progress) ** 3;
      state.currentX = state.startX + (state.targetX - state.startX) * easedProgress;
      state.currentY = state.startY + (state.targetY - state.startY) * easedProgress;
      updates.push(toSmoothedCursor(state));
      if (progress < 1) {
        hasMovingCursor = true;
      }
    }
    if (updates.length > 0) {
      this.options.publish(updates);
    }
    if (hasMovingCursor) {
      this.scheduleFrame();
    }
  };

  private cancelFrame(frameId: number) {
    if (this.options.cancelFrame) {
      this.options.cancelFrame(frameId);
      return;
    }
    cancelAnimationFrame(frameId);
  }

  private now() {
    return this.options.now?.() ?? performance.now();
  }

  private scheduleFrame() {
    if (this.frameId !== null) {
      return;
    }
    this.frameId = this.options.requestFrame
      ? this.options.requestFrame(this.animate)
      : requestAnimationFrame(this.animate);
  }
}
