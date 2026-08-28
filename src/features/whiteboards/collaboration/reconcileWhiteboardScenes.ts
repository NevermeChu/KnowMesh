'use client';

import { loadFromBlob, reconcileElements } from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createWhiteboardScene } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';

async function restoreScene(scene: WhiteboardScene) {
  return await loadFromBlob(
    new Blob([JSON.stringify(scene)], { type: 'application/vnd.excalidraw+json' }),
    null,
    null,
  );
}

export async function reconcileWhiteboardScenes(options: {
  api: ExcalidrawImperativeAPI;
  localScene: WhiteboardScene;
  remoteScene: WhiteboardScene;
}) {
  const [local, remote] = await Promise.all([
    restoreScene(options.localScene),
    restoreScene(options.remoteScene),
  ]);
  const elements = reconcileElements(
    local.elements ?? [],
    // The public loader returns ordered elements while the public reconcile API
    // uses a compile-time brand for the same remote wire representation.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The brand has no runtime field.
    (remote.elements ?? []) as unknown as readonly RemoteExcalidrawElement[],
    options.api.getAppState(),
  );
  return createWhiteboardScene({ appState: options.api.getAppState(), elements });
}
