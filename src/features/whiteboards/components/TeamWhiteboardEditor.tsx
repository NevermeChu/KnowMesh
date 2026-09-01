'use client';

import { CaptureUpdateAction, Excalidraw, loadFromBlob } from '@excalidraw/excalidraw';
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getDocumentCollaborationColor } from '@/features/documents/collaboration/DocumentCollaborationPresence';
import { DocumentSaveStatus } from '@/features/documents/components/DocumentSaveStatus';
import type {
  CollaborationState,
  SaveState,
} from '@/features/documents/components/DocumentSaveStatus';
import { StarDocumentButton } from '@/features/documents/components/StarDocumentButton';
import type { WhiteboardDocument } from '@/features/documents/Document';
import { Env } from '@/libs/Env';
import {
  reconcileWhiteboardScenes,
  reconcileWhiteboardSceneUpdate,
} from '../collaboration/reconcileWhiteboardScenes';
import { TeamWhiteboardCursorSmoother } from '../collaboration/TeamWhiteboardCursorSmoother';
import type { SmoothedWhiteboardCursor } from '../collaboration/TeamWhiteboardCursorSmoother';
import { TeamWhiteboardRealtimePublisher } from '../collaboration/TeamWhiteboardRealtimePublisher';
import { TeamWhiteboardSaveQueue } from '../collaboration/TeamWhiteboardSaveQueue';
import {
  WHITEBOARD_COLLABORATION_PATH,
  whiteboardSaveAcknowledgementSchema,
} from '../collaboration/WhiteboardCollaborationProtocol';
import type {
  WhiteboardClientToServerEvents,
  WhiteboardCollaborationMember,
  WhiteboardCursorUpdate,
  WhiteboardRemoteSceneUpdate,
  WhiteboardServerToClientEvents,
} from '../collaboration/WhiteboardCollaborationProtocol';
import { createWhiteboardScene, WhiteboardRemoteSceneEchoGuard } from '../WhiteboardScene';
import type { WhiteboardScene } from '../WhiteboardScene';
import { WhiteboardCanvasFrame } from './WhiteboardCanvasFrame';
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

async function restoreScene(scene: WhiteboardScene) {
  return await loadFromBlob(
    new Blob([JSON.stringify(scene)], { type: 'application/vnd.excalidraw+json' }),
    null,
    null,
  );
}

function toCollaboratorSocketId(connectionId: string) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Excalidraw brands collaborator map keys as SocketId.
  return connectionId as SocketId;
}

function toCollaborators(options: {
  currentConnectionId: string | undefined;
  current: Map<SocketId, Collaborator>;
  members: WhiteboardCollaborationMember[];
}) {
  const collaborators = new Map<SocketId, Collaborator>();
  for (const member of options.members) {
    const connectionId = toCollaboratorSocketId(member.connectionId);
    const color = getDocumentCollaborationColor(member.id);
    const current = options.current.get(connectionId);
    collaborators.set(connectionId, {
      avatarUrl: member.image ?? undefined,
      button: current?.button,
      color: { background: color, stroke: color },
      id: member.id,
      isCurrentUser: member.connectionId === options.currentConnectionId,
      pointer: current?.pointer,
      username: member.name,
    });
  }
  return collaborators;
}

export function TeamWhiteboardEditor(props: { canEdit: boolean; document: WhiteboardDocument }) {
  const enabled = Env.NEXT_PUBLIC_WHITEBOARD_COLLABORATION_ENABLED === 'true';
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const toast = useToast();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const applyingRemoteScene = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const collaboratorsRef = useRef(new Map<SocketId, Collaborator>());
  const receivedCursorSequences = useRef(new Map<string, number>());
  const receivedSceneSequences = useRef(new Map<string, number>());
  const remoteSceneEchoGuard = useRef(new WhiteboardRemoteSceneEchoGuard());
  const queueRef = useRef<TeamWhiteboardSaveQueue | null>(null);
  const realtimePublisherRef = useRef<TeamWhiteboardRealtimePublisher | null>(null);
  const socketRef = useRef<Socket<
    WhiteboardServerToClientEvents,
    WhiteboardClientToServerEvents
  > | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [collaborationState, setCollaborationState] = useState<CollaborationState>(
    enabled ? 'connecting' : 'offline',
  );
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [initialData] = useState(async () => await restoreScene(props.document.scene));
  const isEditable = enabled && props.canEdit && canWrite && collaborationState === 'synced';
  const showFrozenToast = useEffectEvent((reason: 'permission-denied' | 'service-unavailable') => {
    toast.error(reason === 'permission-denied' ? '白板权限已撤回' : '白板协作服务暂不可用');
  });

  useEffect(() => {
    if (!enabled) {
      return () => {
        queueRef.current?.dispose();
        realtimePublisherRef.current?.dispose();
        socketRef.current?.disconnect();
      };
    }
    let cursorRenderFrame = 0;
    const cursorSmoother = new TeamWhiteboardCursorSmoother({
      publish: (updates: SmoothedWhiteboardCursor[]) => {
        let collaborators = collaboratorsRef.current;
        let changed = false;
        for (const update of updates) {
          const connectionId = toCollaboratorSocketId(update.connectionId);
          const collaborator = collaborators.get(connectionId);
          if (!collaborator) {
            continue;
          }
          if (!changed) {
            collaborators = new Map(collaborators);
            changed = true;
          }
          collaborators.set(connectionId, {
            ...collaborator,
            button: update.button,
            pointer: { tool: update.tool, x: update.x, y: update.y },
          });
        }
        if (!changed) {
          return;
        }
        collaboratorsRef.current = collaborators;
        apiRef.current?.updateScene({ collaborators });
        cursorRenderFrame += 1;
        if (canvasRef.current) {
          canvasRef.current.dataset.whiteboardCursorFrame = String(cursorRenderFrame);
        }
      },
    });
    const applyScene = async (scene: WhiteboardScene) => {
      const api = apiRef.current;
      if (!api) {
        return;
      }
      const restored = await restoreScene(scene);
      remoteSceneEchoGuard.current.mark(
        createWhiteboardScene({
          appState: restored.appState ?? {},
          elements: restored.elements ?? [],
        }),
      );
      applyingRemoteScene.current = true;
      api.updateScene({
        appState: restored.appState ?? undefined,
        captureUpdate: CaptureUpdateAction.NEVER,
        elements: restored.elements ?? [],
      });
      queueMicrotask(() => {
        applyingRemoteScene.current = false;
      });
    };
    const applyPresence = (
      presenceMembers: WhiteboardCollaborationMember[],
      currentConnectionId?: string,
    ) => {
      collaboratorsRef.current = toCollaborators({
        current: collaboratorsRef.current,
        currentConnectionId,
        members: presenceMembers,
      });
      cursorSmoother.retainConnections(
        new Set(presenceMembers.map((member) => member.connectionId)),
      );
      apiRef.current?.updateScene({ collaborators: collaboratorsRef.current });
    };
    const socket: Socket<WhiteboardServerToClientEvents, WhiteboardClientToServerEvents> = io(
      Env.NEXT_PUBLIC_WHITEBOARD_COLLABORATION_URL,
      {
        auth: { documentId: props.document.id },
        autoConnect: false,
        path: WHITEBOARD_COLLABORATION_PATH,
        transports: ['websocket'],
        withCredentials: true,
      },
    );
    socketRef.current = socket;
    socket.on('connect', () => {
      setCollaborationState('syncing');
    });
    socket.on('connect_error', () => {
      setCollaborationState('error');
    });
    socket.on('disconnect', () => {
      setCanWrite(false);
      setCollaborationState((current) => (current === 'error' ? current : 'offline'));
    });
    socket.on('presence', (presenceMembers) => {
      applyPresence(presenceMembers, socket.id);
    });
    socket.on('cursor', (cursor: WhiteboardCursorUpdate) => {
      const previousSequence = receivedCursorSequences.current.get(cursor.connectionId) ?? -1;
      if (cursor.clientSequence <= previousSequence) {
        return;
      }
      receivedCursorSequences.current.set(cursor.connectionId, cursor.clientSequence);
      if (canvasRef.current) {
        canvasRef.current.dataset.whiteboardCursorSequence = String(cursor.clientSequence);
      }
      cursorSmoother.push(cursor);
    });
    socket.on('scene', (update: WhiteboardRemoteSceneUpdate) => {
      const previousSequence = receivedSceneSequences.current.get(update.connectionId) ?? -1;
      if (update.clientSequence <= previousSequence) {
        return;
      }
      receivedSceneSequences.current.set(update.connectionId, update.clientSequence);
      const api = apiRef.current;
      if (!api) {
        return;
      }
      const reconciled = reconcileWhiteboardSceneUpdate({ api, update: update.scene });
      realtimePublisherRef.current?.observeScene(update.scene);
      remoteSceneEchoGuard.current.mark(reconciled.scene);
      applyingRemoteScene.current = true;
      api.updateScene({
        appState: reconciled.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
        elements: reconciled.elements,
      });
      if (canvasRef.current) {
        canvasRef.current.dataset.whiteboardElementCount = String(reconciled.elements.length);
        canvasRef.current.dataset.whiteboardRealtimeSequence = String(update.clientSequence);
      }
      queueMicrotask(() => {
        applyingRemoteScene.current = false;
      });
    });
    socket.on('frozen', (reason) => {
      queueRef.current?.freeze(reason);
      setCanWrite(false);
      setCollaborationState('error');
      showFrozenToast(reason);
    });
    socket.on('canonical', (canonical) => {
      setCollaborationState('syncing');
      void (async () => {
        await queueRef.current?.receiveCanonical(canonical);
        setCollaborationState('synced');
      })();
    });
    socket.on('baseline', (baseline) => {
      receivedCursorSequences.current.clear();
      receivedSceneSequences.current.clear();
      cursorSmoother.clear();
      applyPresence(baseline.members, socket.id);
      setCanWrite(baseline.canWrite && props.canEdit);
      queueRef.current?.dispose();
      realtimePublisherRef.current?.dispose();
      void (async () => {
        await applyScene(baseline.scene);
        realtimePublisherRef.current = new TeamWhiteboardRealtimePublisher({
          initialScene: baseline.scene,
          publishCursor: (pointer, volatile) => {
            if (volatile) {
              socket.volatile.emit('cursor', pointer);
            } else {
              socket.emit('cursor', pointer);
            }
          },
          publishScene: (update) => {
            socket.emit('scene', update);
          },
        });
        queueRef.current = new TeamWhiteboardSaveQueue({
          apply: applyScene,
          initialRevision: baseline.revision,
          initialScene: baseline.scene,
          onFrozen: () => {
            setCanWrite(false);
            setCollaborationState('error');
          },
          onStateChange: setSaveState,
          reconcile: async (localScene, remoteScene) => {
            const api = apiRef.current;
            if (!api) {
              return remoteScene;
            }
            return await reconcileWhiteboardScenes({ api, localScene, remoteScene });
          },
          save: async (candidate) =>
            whiteboardSaveAcknowledgementSchema.parse(
              await socket.timeout(8000).emitWithAck('save', candidate),
            ),
        });
        setCollaborationState('synced');
      })();
    });
    socket.connect();
    return () => {
      cursorSmoother.dispose();
      queueRef.current?.dispose();
      realtimePublisherRef.current?.dispose();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, props.canEdit, props.document.id]);

  return (
    <WhiteboardCanvasFrame
      nestBesideExcalidrawMenu={isEditable}
      status={
        enabled ? undefined : <span className="text-xs text-ink-faint">团队白板（协作已关闭）</span>
      }
      documentActions={
        <>
          <DocumentSaveStatus
            canEdit={isEditable}
            collaborationState={enabled ? collaborationState : undefined}
            state={saveState}
          />
          {saveState === 'error' && collaborationState === 'synced' && (
            <Button
              onClick={() => {
                queueRef.current?.retry();
              }}
              type="button"
            >
              重试保存
            </Button>
          )}
          <WhiteboardExportMenu
            getApi={() => apiRef.current}
            getScene={() => queueRef.current?.getLatestScene() ?? props.document.scene}
            title={props.document.title}
          />
          <StarDocumentButton
            documentId={props.document.id}
            initialIsStarred={props.document.isStarred ?? false}
          />
        </>
      }
      canvas={
        <div className="h-full min-h-0" ref={canvasRef}>
          <Excalidraw
            UIOptions={{
              canvasActions: isEditable ? editableCanvasActions : readonlyCanvasActions,
              tools: { image: false },
            }}
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            initialData={initialData}
            isCollaborating={enabled}
            langCode="zh-CN"
            onChange={(elements, appState, files) => {
              if (!isEditable || applyingRemoteScene.current) {
                return;
              }
              if (Object.keys(files).length > 0) {
                toast.error('当前白板尚不支持图片或二进制资产');
                return;
              }
              try {
                const scene = createWhiteboardScene({ appState, elements });
                if (remoteSceneEchoGuard.current.shouldIgnore(scene)) {
                  return;
                }
                realtimePublisherRef.current?.enqueueScene(scene);
                queueRef.current?.enqueue(scene);
              } catch {
                setSaveState('error');
                toast.error('白板内容超出当前可保存的格式或大小限制');
              }
            }}
            onLinkOpen={(_element, event) => {
              event.preventDefault();
            }}
            onPaste={(data) =>
              !(
                Object.keys(data.files ?? {}).length > 0 ||
                data.mixedContent?.some((item) => item.type === 'imageUrl')
              )
            }
            onPointerUpdate={(payload) => {
              const pointer = {
                button: payload.button,
                tool: payload.pointer.tool,
                x: payload.pointer.x,
                y: payload.pointer.y,
              };
              realtimePublisherRef.current?.enqueueCursor(pointer);
            }}
            theme={theme}
            validateEmbeddable={false}
            viewModeEnabled={!isEditable}
            zenModeEnabled={!isEditable}
          />
        </div>
      }
    />
  );
}
