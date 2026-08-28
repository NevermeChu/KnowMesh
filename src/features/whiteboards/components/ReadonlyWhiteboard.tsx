'use client';

import { Excalidraw, loadFromBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useState, useSyncExternalStore } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { StarDocumentButton } from '@/features/documents/components/StarDocumentButton';
import type { WhiteboardDocument } from '@/features/documents/Document';

const disabledCanvasActions = {
  changeViewBackgroundColor: false,
  clearCanvas: false,
  export: false,
  loadScene: false,
  saveAsImage: false,
  saveToActiveFile: false,
  toggleTheme: false,
} as const;

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributeFilter: ['class'], attributes: true });
  return () => {
    observer.disconnect();
  };
}

const getThemeSnapshot = () =>
  document.documentElement.classList.contains('dark') ? ('dark' as const) : ('light' as const);

const getServerThemeSnapshot = () => 'light' as const;

export function ReadonlyWhiteboard(props: { document: WhiteboardDocument }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const [initialData] = useState(
    async () =>
      await loadFromBlob(
        new Blob([JSON.stringify(props.document.scene)], {
          type: 'application/vnd.excalidraw+json',
        }),
        null,
        null,
      ),
  );

  return (
    <WorkspaceContent className="py-6 sm:py-8">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-faint">只读白板</p>
          <h1 className="truncate text-xl font-semibold text-ink">{props.document.title}</h1>
        </div>
        <StarDocumentButton
          documentId={props.document.id}
          initialIsStarred={props.document.isStarred ?? false}
        />
      </header>
      <div className="h-[calc(100dvh-var(--content-top-offset)-7rem)] min-h-[32rem] overflow-hidden rounded-xl border border-line bg-card shadow-card">
        <Excalidraw
          UIOptions={{ canvasActions: disabledCanvasActions, tools: { image: false } }}
          initialData={initialData}
          langCode="zh-CN"
          onLinkOpen={(_element, event) => {
            event.preventDefault();
          }}
          theme={theme}
          validateEmbeddable={false}
          viewModeEnabled={true}
          zenModeEnabled={true}
        />
      </div>
    </WorkspaceContent>
  );
}
