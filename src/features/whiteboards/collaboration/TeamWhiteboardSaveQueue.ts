import type { SaveState } from '@/features/documents/components/DocumentSaveStatus';
import type { WhiteboardScene } from '../WhiteboardScene';
import {
  MAX_WHITEBOARD_CONFLICT_RETRIES,
  WHITEBOARD_SAVE_DEBOUNCE_MS,
} from './WhiteboardCollaborationProtocol';
import type {
  WhiteboardCanonicalScene,
  WhiteboardSaveAcknowledgement,
} from './WhiteboardCollaborationProtocol';

export class TeamWhiteboardSaveQueue {
  private activeDrain: Promise<void> | null = null;
  private canonicalScene: WhiteboardScene;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private frozen = false;
  private latestScene: WhiteboardScene;
  private pending = false;
  private retryCount = 0;
  private revision: number;
  private serialOperation = Promise.resolve();
  private readonly options: {
    apply: (scene: WhiteboardScene) => Promise<void> | void;
    initialRevision: number;
    initialScene: WhiteboardScene;
    onFrozen: (reason: 'permission-denied' | 'service-unavailable') => void;
    onStateChange: (state: SaveState) => void;
    reconcile: (local: WhiteboardScene, remote: WhiteboardScene) => Promise<WhiteboardScene>;
    save: (options: {
      clientMutationId: string;
      expectedRevision: number;
      scene: WhiteboardScene;
    }) => Promise<WhiteboardSaveAcknowledgement>;
  };

  constructor(options: TeamWhiteboardSaveQueue['options']) {
    this.options = options;
    this.canonicalScene = options.initialScene;
    this.latestScene = options.initialScene;
    this.revision = options.initialRevision;
  }

  enqueue(scene: WhiteboardScene) {
    if (this.frozen) {
      return;
    }
    this.latestScene = scene;
    this.pending = JSON.stringify(scene) !== JSON.stringify(this.canonicalScene);
    this.options.onStateChange(this.pending ? 'saving' : 'saved');
    if (!this.pending) {
      return;
    }
    this.scheduleFlush();
  }

  freeze(reason: 'permission-denied' | 'service-unavailable') {
    this.frozen = true;
    this.clearDebounce();
    this.options.onFrozen(reason);
  }

  getLatestScene() {
    return this.latestScene;
  }

  async receiveCanonical(canonical: WhiteboardCanonicalScene) {
    // oxlint-disable-next-line promise/prefer-await-to-then -- This promise is the queue mutex tail.
    this.serialOperation = this.serialOperation.then(async () => {
      if (canonical.revision <= this.revision || this.frozen) {
        return;
      }
      const hadLocalChanges =
        JSON.stringify(this.latestScene) !== JSON.stringify(this.canonicalScene);
      this.revision = canonical.revision;
      this.canonicalScene = canonical.scene;
      this.latestScene = hadLocalChanges
        ? await this.options.reconcile(this.latestScene, canonical.scene)
        : canonical.scene;
      this.pending = JSON.stringify(this.latestScene) !== JSON.stringify(this.canonicalScene);
      await this.options.apply(this.latestScene);
      if (this.pending) {
        this.options.onStateChange('saving');
        this.scheduleFlush();
      } else {
        this.options.onStateChange('saved');
      }
    });
    await this.serialOperation;
  }

  async flush() {
    this.clearDebounce();
    if (this.activeDrain) {
      await this.activeDrain;
      if (this.pending) {
        this.scheduleFlush();
      }
      return;
    }
    // oxlint-disable-next-line promise/prefer-await-to-then -- Drain must start behind the queue mutex.
    this.activeDrain = this.serialOperation.then(async () => {
      await this.drain();
    });
    try {
      await this.activeDrain;
    } finally {
      this.activeDrain = null;
    }
  }

  retry() {
    if (!this.frozen) {
      void this.flush();
    }
  }

  dispose() {
    this.clearDebounce();
  }

  private clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleFlush(delayMs = WHITEBOARD_SAVE_DEBOUNCE_MS) {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => void this.flush(), delayMs);
  }

  private async drain() {
    while (this.pending && !this.frozen) {
      const candidate = this.latestScene;
      this.pending = false;
      this.options.onStateChange('saving');
      let result: WhiteboardSaveAcknowledgement;
      try {
        result = await this.options.save({
          clientMutationId: crypto.randomUUID(),
          expectedRevision: this.revision,
          scene: candidate,
        });
      } catch {
        this.pending = true;
        this.options.onStateChange('error');
        return;
      }
      if (result.status === 'error') {
        this.pending = true;
        if (result.message === 'permission-denied') {
          this.freeze('permission-denied');
        } else if (result.message === 'rate-limited') {
          this.options.onStateChange('saving');
          this.scheduleFlush(result.retryAfterMs);
        } else {
          this.options.onStateChange('error');
        }
        return;
      }
      this.revision = result.revision;
      this.canonicalScene = result.scene;
      if (result.status === 'conflict') {
        this.retryCount += 1;
        if (this.retryCount > MAX_WHITEBOARD_CONFLICT_RETRIES) {
          this.freeze('service-unavailable');
          return;
        }
        this.latestScene = await this.options.reconcile(this.latestScene, result.scene);
        this.pending = true;
        await this.options.apply(this.latestScene);
        continue;
      }
      this.retryCount = 0;
      this.pending = JSON.stringify(this.latestScene) !== JSON.stringify(candidate);
      if (this.pending) {
        this.options.onStateChange('saving');
        this.scheduleFlush();
        return;
      }
      break;
    }
    this.options.onStateChange('saved');
  }
}
