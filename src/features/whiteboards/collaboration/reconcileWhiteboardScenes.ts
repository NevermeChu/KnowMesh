'use client';

import {
  loadFromBlob,
  reconcileElements,
  restoreAppState,
  restoreElements,
} from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { ImportedDataState } from '@excalidraw/excalidraw/data/types';
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

export function reconcileWhiteboardSceneUpdate(options: {
  api: ExcalidrawImperativeAPI;
  update: WhiteboardScene;
}) {
  const localElements = options.api.getSceneElementsIncludingDeleted();
  const appState = restoreAppState(
    {
      ...options.update.appState,
      gridSize: options.update.appState.gridSize ?? undefined,
    },
    options.api.getAppState(),
  );
  const remoteElements = restoreElements(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Runtime validation guarantees the persisted Excalidraw element shape.
    options.update.elements as unknown as ImportedDataState['elements'],
    localElements,
  );
  const elements = reconcileElements(
    localElements,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The public restore result has the remote wire shape and the brand has no runtime field.
    remoteElements as unknown as readonly RemoteExcalidrawElement[],
    options.api.getAppState(),
  );
  const scene = createWhiteboardScene({
    appState,
    elements,
  });
  return { appState, elements, scene };
}
