import { describe, expect, it, vi } from 'vitest';
import type { SaveState } from '@/features/documents/components/DocumentSaveStatus';
import { WhiteboardSaveQueue } from './WhiteboardSaveQueue';
import type { WhiteboardSaveResult } from './WhiteboardSaveQueue';
import { EMPTY_WHITEBOARD_SCENE } from './WhiteboardScene';
import type { WhiteboardScene } from './WhiteboardScene';

const changedScene = {
  ...EMPTY_WHITEBOARD_SCENE,
  appState: { viewBackgroundColor: '#f8fafc' },
};

describe(WhiteboardSaveQueue, () => {
  it('serializes saves and keeps the latest pending scene', async () => {
    const firstSave = Promise.withResolvers<WhiteboardSaveResult>();
    const save = vi
      .fn<(scene: WhiteboardScene, expectedRevision: number) => Promise<WhiteboardSaveResult>>()
      .mockImplementationOnce(async () => await firstSave.promise)
      .mockResolvedValue({ revision: 3, status: 'saved', updatedAt: new Date() });
    const queue = new WhiteboardSaveQueue({
      debounceMs: 0,
      initialRevision: 1,
      initialScene: EMPTY_WHITEBOARD_SCENE,
      onStateChange: vi.fn<(state: SaveState) => void>(),
      save,
    });
    const firstFlush = (queue.enqueue(changedScene), queue.flush());
    const latestScene = { ...changedScene, appState: { viewBackgroundColor: '#ffffff' } };
    queue.enqueue(latestScene);
    firstSave.resolve({ revision: 2, status: 'saved', updatedAt: new Date() });
    await firstFlush;

    expect(save).toHaveBeenNthCalledWith(1, changedScene, 1);
    expect(save).toHaveBeenNthCalledWith(2, latestScene, 2);
    expect(queue.hasUnsavedChanges()).toBeFalsy();
  });

  it('stops stale saves after a revision conflict', async () => {
    const onStateChange = vi.fn<(state: SaveState) => void>();
    const save = vi
      .fn<(scene: WhiteboardScene, expectedRevision: number) => Promise<WhiteboardSaveResult>>()
      .mockResolvedValue({ revision: 4, status: 'conflict' });
    const queue = new WhiteboardSaveQueue({
      initialRevision: 1,
      initialScene: EMPTY_WHITEBOARD_SCENE,
      onStateChange,
      save,
    });
    queue.enqueue(changedScene);
    await queue.flush();
    queue.enqueue({ ...changedScene, appState: { viewBackgroundColor: '#000000' } });
    await queue.flush();

    expect(save).toHaveBeenCalledOnce();
    expect(onStateChange).toHaveBeenLastCalledWith('conflict');
    expect(queue.hasUnsavedChanges()).toBeTruthy();
  });

  it('retains the scene after a save failure for manual retry', async () => {
    const onStateChange = vi.fn<(state: SaveState) => void>();
    const save = vi
      .fn<(scene: WhiteboardScene, expectedRevision: number) => Promise<WhiteboardSaveResult>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ revision: 2, status: 'saved', updatedAt: new Date() });
    const queue = new WhiteboardSaveQueue({
      initialRevision: 1,
      initialScene: EMPTY_WHITEBOARD_SCENE,
      onStateChange,
      save,
    });
    queue.enqueue(changedScene);
    await queue.flush();

    expect(onStateChange).toHaveBeenLastCalledWith('error');
    expect(queue.hasUnsavedChanges()).toBeTruthy();

    queue.retry();
    await queue.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(onStateChange).toHaveBeenLastCalledWith('saved');
  });
});
