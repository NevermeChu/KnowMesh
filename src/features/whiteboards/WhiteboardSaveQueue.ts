import type { SaveState } from '@/features/documents/components/DocumentSaveStatus';
import type { WhiteboardScene } from './WhiteboardScene';

export type WhiteboardSaveResult =
  | { revision: number; status: 'conflict' }
  | { revision: number; status: 'saved'; updatedAt: Date };

export class WhiteboardSaveQueue {
  private activeFlush: Promise<void> | null = null;
  private conflict = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedScene: string;
  private latestScene: WhiteboardScene;
  private pendingScene: WhiteboardScene | null = null;
  private revision: number;
  private readonly options: {
    debounceMs?: number;
    initialRevision: number;
    initialScene: WhiteboardScene;
    onStateChange: (state: SaveState) => void;
    save: (scene: WhiteboardScene, expectedRevision: number) => Promise<WhiteboardSaveResult>;
  };

  constructor(options: {
    debounceMs?: number;
    initialRevision: number;
    initialScene: WhiteboardScene;
    onStateChange: (state: SaveState) => void;
    save: (scene: WhiteboardScene, expectedRevision: number) => Promise<WhiteboardSaveResult>;
  }) {
    this.options = options;
    this.lastSavedScene = JSON.stringify(options.initialScene);
    this.latestScene = options.initialScene;
    this.revision = options.initialRevision;
  }

  enqueue(scene: WhiteboardScene) {
    this.latestScene = scene;
    this.pendingScene = scene;

    if (this.conflict) {
      this.options.onStateChange('conflict');
      return;
    }

    if (JSON.stringify(scene) === this.lastSavedScene && !this.activeFlush) {
      this.pendingScene = null;
      this.options.onStateChange('saved');
      return;
    }

    this.options.onStateChange('saving');
    this.clearDebounceTimer();
    this.debounceTimer = setTimeout(() => {
      void this.flush();
    }, this.options.debounceMs ?? 800);
  }

  async flush() {
    this.clearDebounceTimer();
    if (this.activeFlush) {
      await this.activeFlush;
      return;
    }

    this.activeFlush = this.drain();
    try {
      await this.activeFlush;
    } finally {
      this.activeFlush = null;
    }
  }

  getLatestScene() {
    return this.latestScene;
  }

  hasUnsavedChanges() {
    return (
      this.activeFlush !== null ||
      this.pendingScene !== null ||
      JSON.stringify(this.latestScene) !== this.lastSavedScene
    );
  }

  retry() {
    if (this.conflict) {
      return;
    }
    void this.flush();
  }

  dispose() {
    this.clearDebounceTimer();
  }

  private clearDebounceTimer() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private async drain() {
    while (this.pendingScene && !this.conflict) {
      const candidate = this.pendingScene;
      this.pendingScene = null;
      this.options.onStateChange('saving');

      try {
        const result = await this.options.save(candidate, this.revision);
        if (result.status === 'conflict') {
          this.revision = result.revision;
          this.conflict = true;
          this.pendingScene ??= candidate;
          this.options.onStateChange('conflict');
          return;
        }

        this.revision = result.revision;
        this.lastSavedScene = JSON.stringify(candidate);
      } catch {
        this.pendingScene ??= candidate;
        this.options.onStateChange('error');
        return;
      }
    }

    if (!this.conflict) {
      this.options.onStateChange('saved');
    }
  }
}
