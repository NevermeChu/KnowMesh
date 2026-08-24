import type { Awareness } from 'y-protocols/awareness';

export const DOCUMENT_COLLABORATION_CURSOR_THROTTLE_MS = 50;

const CURSOR_AWARENESS_FIELD = 'cursor';
const NO_PENDING_CURSOR = Symbol('no-pending-cursor');

/**
 * Coalesces local cursor awareness changes without delaying document updates or presence removal.
 *
 * @param awareness - Room awareness instance used by the collaboration caret extension.
 * @returns Cleanup that removes the local cursor and restores the original awareness method.
 */
export function throttleDocumentCollaborationCursorAwareness(awareness: Awareness) {
  const originalSetLocalStateField = awareness.setLocalStateField.bind(awareness);
  let pendingCursor: unknown = NO_PENDING_CURSOR;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const sendField = (field: string, value: unknown) => {
    originalSetLocalStateField(field, value);
  };

  const clearFlushTimer = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  };

  const flushPendingCursor = () => {
    if (pendingCursor === NO_PENDING_CURSOR) {
      return;
    }

    const cursor = pendingCursor;
    pendingCursor = NO_PENDING_CURSOR;
    sendField(CURSOR_AWARENESS_FIELD, cursor);
  };

  awareness.setLocalStateField = (field: string, value: unknown) => {
    if (field !== CURSOR_AWARENESS_FIELD) {
      sendField(field, value);
      return;
    }

    if (value === null) {
      clearFlushTimer();
      pendingCursor = NO_PENDING_CURSOR;
      sendField(field, value);
      return;
    }

    pendingCursor = value;
    flushTimer ??= setTimeout(() => {
      flushTimer = null;
      flushPendingCursor();
    }, DOCUMENT_COLLABORATION_CURSOR_THROTTLE_MS);
  };

  return () => {
    clearFlushTimer();
    pendingCursor = NO_PENDING_CURSOR;
    sendField(CURSOR_AWARENESS_FIELD, null);
    awareness.setLocalStateField = originalSetLocalStateField;
  };
}
