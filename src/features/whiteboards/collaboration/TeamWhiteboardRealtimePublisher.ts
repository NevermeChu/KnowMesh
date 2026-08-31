import type * as z from 'zod';
import type { WhiteboardScene } from '../WhiteboardScene';
import { WHITEBOARD_REALTIME_INTERVAL_MS } from './WhiteboardCollaborationProtocol';
import type {
  WhiteboardLiveSceneUpdate,
  whiteboardPointerSchema,
} from './WhiteboardCollaborationProtocol';

type WhiteboardPointer = z.infer<typeof whiteboardPointerSchema>;

const getElementId = (element: WhiteboardScene['elements'][number]) =>
  typeof element.id === 'string' ? element.id : '';

const getElementVersion = (element: WhiteboardScene['elements'][number]) =>
  JSON.stringify([element.version, element.versionNonce, element.isDeleted]);

export class TeamWhiteboardRealtimePublisher {
  private appStateFingerprint: string;
  private cursorButton: 'down' | 'up' = 'up';
  private cursorSequence = 0;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly elementVersions = new Map<string, string>();
  private pendingCursor: Omit<WhiteboardPointer, 'clientSequence'> | null = null;
  private pendingScene: WhiteboardScene | null = null;
  private sceneSequence = 0;
  private sceneTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: {
    initialScene: WhiteboardScene;
    publishCursor: (pointer: WhiteboardPointer, volatile: boolean) => void;
    publishScene: (update: WhiteboardLiveSceneUpdate) => void;
  };

  constructor(options: TeamWhiteboardRealtimePublisher['options']) {
    this.options = options;
    this.appStateFingerprint = JSON.stringify(options.initialScene.appState);
    this.observeScene(options.initialScene);
  }

  dispose() {
    if (this.cursorTimer) {
      clearTimeout(this.cursorTimer);
    }
    if (this.sceneTimer) {
      clearTimeout(this.sceneTimer);
    }
    this.cursorTimer = null;
    this.sceneTimer = null;
    this.pendingCursor = null;
    this.pendingScene = null;
  }

  enqueueCursor(pointer: Omit<WhiteboardPointer, 'clientSequence'>) {
    const completesDrag = this.cursorButton === 'down' && pointer.button === 'up';
    this.cursorButton = pointer.button;
    if (completesDrag) {
      this.flushCursor(pointer);
      this.flushScene();
      return;
    }
    this.pendingCursor = pointer;
    if (!this.cursorTimer) {
      this.publishPendingCursor(true);
    }
  }

  enqueueScene(scene: WhiteboardScene) {
    this.pendingScene = scene;
    if (!this.sceneTimer) {
      this.publishPendingScene();
    }
  }

  flushCursor(pointer: Omit<WhiteboardPointer, 'clientSequence'>) {
    this.cursorButton = pointer.button;
    if (this.cursorTimer) {
      clearTimeout(this.cursorTimer);
      this.cursorTimer = null;
    }
    this.pendingCursor = null;
    this.options.publishCursor({ ...pointer, clientSequence: this.cursorSequence }, false);
    this.cursorSequence += 1;
  }

  flushScene() {
    if (this.sceneTimer) {
      clearTimeout(this.sceneTimer);
      this.sceneTimer = null;
    }
    this.publishPendingScene();
  }

  observeScene(scene: WhiteboardScene) {
    this.appStateFingerprint = JSON.stringify(scene.appState);
    for (const element of scene.elements) {
      this.elementVersions.set(getElementId(element), getElementVersion(element));
    }
  }

  private publishPendingCursor(volatile: boolean) {
    const pointer = this.pendingCursor;
    this.pendingCursor = null;
    if (pointer) {
      this.options.publishCursor({ ...pointer, clientSequence: this.cursorSequence }, volatile);
      this.cursorSequence += 1;
    }
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null;
      if (this.pendingCursor) {
        this.publishPendingCursor(true);
      }
    }, WHITEBOARD_REALTIME_INTERVAL_MS);
  }

  private publishPendingScene() {
    const scene = this.pendingScene;
    this.pendingScene = null;
    if (scene) {
      const appStateFingerprint = JSON.stringify(scene.appState);
      const changedElements = scene.elements.filter(
        (element) => this.elementVersions.get(getElementId(element)) !== getElementVersion(element),
      );
      if (changedElements.length > 0 || appStateFingerprint !== this.appStateFingerprint) {
        this.options.publishScene({
          clientSequence: this.sceneSequence,
          scene: { ...scene, elements: changedElements },
        });
        this.sceneSequence += 1;
        this.observeScene(scene);
      }
    }
    this.sceneTimer = setTimeout(() => {
      this.sceneTimer = null;
      if (this.pendingScene) {
        this.publishPendingScene();
      }
    }, WHITEBOARD_REALTIME_INTERVAL_MS);
  }
}
