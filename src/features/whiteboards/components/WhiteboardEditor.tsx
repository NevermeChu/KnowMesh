'use client';

import { Excalidraw, loadFromBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { DocumentSaveStatus } from '@/features/documents/components/DocumentSaveStatus';
import type { SaveState } from '@/features/documents/components/DocumentSaveStatus';
import { StarDocumentButton } from '@/features/documents/components/StarDocumentButton';
import type { WhiteboardDocument } from '@/features/documents/Document';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { updatePersonalWhiteboard } from '../server/UpdatePersonalWhiteboard';
import { WhiteboardSaveQueue } from '../WhiteboardSaveQueue';
import { createWhiteboardScene } from '../WhiteboardScene';
import { TeamWhiteboardEditor } from './TeamWhiteboardEditor';
import { WhiteboardExportMenu } from './WhiteboardExportMenu';

const readonlyCanvasActions = {
  changeViewBackgroundColor: false,
  clearCanvas: false,
  export: false,
  loadScene: false,
  saveAsImage: false,
  saveToActiveFile: false,
  toggleTheme: false,
} as const;

const editableCanvasActions = {
  ...readonlyCanvasActions,
  changeViewBackgroundColor: true,
  clearCanvas: true,
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

function PersonalWhiteboardEditor(props: {
  canEdit: boolean;
  document: WhiteboardDocument;
  workspaceKind: WorkspaceKind;
}) {
  const isEditable = props.canEdit && props.workspaceKind === 'personal';
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const toast = useToast();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const rejectedAssetToastVisible = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
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
  const queueRef = useRef<WhiteboardSaveQueue | null>(null);

  queueRef.current ??= new WhiteboardSaveQueue({
    initialRevision: props.document.revision,
    initialScene: props.document.scene,
    onStateChange: setSaveState,
    save: async (scene, expectedRevision) =>
      await updatePersonalWhiteboard({
        documentId: props.document.id,
        expectedRevision,
        scene,
      }),
  });
  const queue = queueRef.current;

  useEffect(() => {
    if (!isEditable) {
      return () => {
        queue.dispose();
      };
    }

    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        void queue.flush();
      }
    };
    const flushBeforePageHide = () => {
      void queue.flush();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.hasUnsavedChanges()) {
        event.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('beforeunload', warnBeforeUnload);
    window.addEventListener('pagehide', flushBeforePageHide);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('beforeunload', warnBeforeUnload);
      window.removeEventListener('pagehide', flushBeforePageHide);
      void queue.flush();
      queue.dispose();
    };
  }, [isEditable, queue]);

  const rejectUnsupportedAssets = () => {
    if (!rejectedAssetToastVisible.current) {
      rejectedAssetToastVisible.current = true;
      toast.error('当前白板尚不支持图片或二进制资产');
      setTimeout(() => {
        rejectedAssetToastVisible.current = false;
      }, 3000);
    }
  };

  return (
    <WorkspaceContent className="py-6 sm:py-8">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-faint">
            {isEditable ? '个人白板' : '只读白板'}
          </p>
          <h1 className="truncate text-xl font-semibold text-ink">{props.document.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <DocumentSaveStatus canEdit={isEditable} state={saveState} />
          {saveState === 'error' && (
            <Button
              onClick={() => {
                queue.retry();
              }}
              type="button"
            >
              重试保存
            </Button>
          )}
          <WhiteboardExportMenu
            getApi={() => apiRef.current}
            getScene={() => queue.getLatestScene()}
            title={props.document.title}
          />
          <StarDocumentButton
            documentId={props.document.id}
            initialIsStarred={props.document.isStarred ?? false}
          />
        </div>
      </header>
      {saveState === 'conflict' && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>服务端已有更新版本。已停止自动覆盖，可先导出本地备份再刷新。</span>
          <Button
            onClick={() => {
              window.location.reload();
            }}
            type="button"
          >
            刷新
          </Button>
        </div>
      )}
      <div
        className="h-[calc(100dvh-var(--content-top-offset)-7rem)] min-h-[32rem] overflow-hidden rounded-xl border border-line bg-card shadow-card"
        onDropCapture={(event) => {
          if (event.dataTransfer.files.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            rejectUnsupportedAssets();
          }
        }}
      >
        <Excalidraw
          UIOptions={{
            canvasActions: isEditable ? editableCanvasActions : readonlyCanvasActions,
            tools: { image: false },
          }}
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={initialData}
          langCode="zh-CN"
          onChange={(elements, appState, files) => {
            if (!isEditable) {
              return;
            }
            if (Object.keys(files).length > 0) {
              rejectUnsupportedAssets();
            }
            try {
              queue.enqueue(createWhiteboardScene({ appState, elements }));
            } catch {
              setSaveState('error');
              toast.error('白板内容超出当前可保存的格式或大小限制');
            }
          }}
          onLinkOpen={(_element, event) => {
            event.preventDefault();
          }}
          onPaste={(data) => {
            if (
              (data.files && Object.keys(data.files).length > 0) ||
              data.mixedContent?.some((item) => item.type === 'imageUrl')
            ) {
              rejectUnsupportedAssets();
              return false;
            }
            return true;
          }}
          theme={theme}
          validateEmbeddable={false}
          viewModeEnabled={!isEditable}
          zenModeEnabled={!isEditable}
        />
      </div>
    </WorkspaceContent>
  );
}

export function WhiteboardEditor(props: {
  canEdit: boolean;
  document: WhiteboardDocument;
  workspaceKind: WorkspaceKind;
}) {
  if (props.workspaceKind === 'team') {
    return <TeamWhiteboardEditor canEdit={props.canEdit} document={props.document} />;
  }
  return <PersonalWhiteboardEditor {...props} />;
}
