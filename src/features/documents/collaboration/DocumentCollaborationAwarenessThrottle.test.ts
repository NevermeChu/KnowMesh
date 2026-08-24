import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import {
  DOCUMENT_COLLABORATION_CURSOR_THROTTLE_MS,
  throttleDocumentCollaborationCursorAwareness,
} from './DocumentCollaborationAwarenessThrottle';

describe('document collaboration awareness throttle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces cursor changes within one fixed window', () => {
    vi.useFakeTimers();
    const document = new Y.Doc();
    const awareness = new Awareness(document);
    const cleanup = throttleDocumentCollaborationCursorAwareness(awareness);
    let updateCount = 0;
    awareness.on('update', () => {
      updateCount += 1;
    });

    awareness.setLocalStateField('cursor', { anchor: 1, head: 1 });
    awareness.setLocalStateField('cursor', { anchor: 2, head: 3 });

    expect(awareness.getLocalState()?.cursor).toBeUndefined();
    expect(updateCount).toBe(0);
    vi.advanceTimersByTime(DOCUMENT_COLLABORATION_CURSOR_THROTTLE_MS);
    expect(awareness.getLocalState()?.cursor).toStrictEqual({ anchor: 2, head: 3 });
    expect(updateCount).toBe(1);

    cleanup();
    awareness.destroy();
    document.destroy();
  });

  it('keeps identity, removal, and cleanup lifecycle immediate', () => {
    vi.useFakeTimers();
    const document = new Y.Doc();
    const awareness = new Awareness(document);
    const cleanup = throttleDocumentCollaborationCursorAwareness(awareness);

    awareness.setLocalStateField('user', { id: 'user-1', name: 'Member' });

    expect(awareness.getLocalState()?.user).toStrictEqual({ id: 'user-1', name: 'Member' });

    awareness.setLocalStateField('cursor', { anchor: 1, head: 1 });
    awareness.setLocalStateField('cursor', null);
    vi.advanceTimersByTime(DOCUMENT_COLLABORATION_CURSOR_THROTTLE_MS);

    expect(awareness.getLocalState()?.cursor).toBeNull();

    awareness.setLocalStateField('cursor', { anchor: 1, head: 1 });
    cleanup();
    awareness.setLocalStateField('cursor', { anchor: 4, head: 4 });

    expect(awareness.getLocalState()?.cursor).toStrictEqual({ anchor: 4, head: 4 });

    awareness.destroy();
    document.destroy();
  });
});
