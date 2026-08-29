'use client';

import { Excalidraw, loadFromBlob } from '@excalidraw/excalidraw';
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
import { reconcileWhiteboardScenes } from '../collaboration/reconcileWhiteboardScenes';
import { TeamWhiteboardSaveQueue } from '../collaboration/TeamWhiteboardSaveQueue';
import {
  WHITEBOARD_COLLABORATION_PATH,
  whiteboardSaveAcknowledgementSchema,
} from '../collaboration/WhiteboardCollaborationProtocol';
import type {
  WhiteboardClientToServerEvents,
  WhiteboardCollaborationMember,
  WhiteboardServerToClientEvents,
} from '../collaboration/WhiteboardCollaborationProtocol';
import { createWhiteboardScene } from '../WhiteboardScene';
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

function toCollaboratorSocketId(memberId: string, index: number) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Excalidraw brands collaborator map keys as SocketId.
  return `${memberId}:${index}` as SocketId;
}

function toCollaborators(members: WhiteboardCollaborationMember[]) {
  const collaborators = new Map<SocketId, Collaborator>();
  for (const [index, member] of members.entries()) {
    const color = getDocumentCollaborationColor(member.id);
    collaborators.set(toCollaboratorSocketId(member.id, index), {
      avatarUrl: member.image ?? undefined,
      button: member.pointer?.button,
      color: { background: color, stroke: color },
      id: member.id,
      pointer: member.pointer
        ? { tool: 'pointer', x: member.pointer.x, y: member.pointer.y }
        : undefined,
      username: member.name,
    });
  }
  return collaborators;
}

function WhiteboardPresence(props: { members: WhiteboardCollaborationMember[] }) {
  if (props.members.length === 0) {
    return null;
  }
  return (
    <div aria-label={`${props.members.length} 位成员在线`} className="flex items-center -space-x-1">
      {props.members.slice(0, 4).map((member, index) => {
        const initial = member.name.trim().slice(0, 1).toLocaleUpperCase();
        return (
          <span
            key={`${member.id}:${index}`}
            className="grid size-6 place-items-center rounded-full border-2 border-canvas bg-accent text-[10px] font-semibold text-white"
            title={member.name}
          >
            {initial.length > 0 ? initial : '?'}
          </span>
        );
      })}
    </div>
  );
}

export function TeamWhiteboardEditor(props: { canEdit: boolean; document: WhiteboardDocument }) {
  const enabled = Env.NEXT_PUBLIC_WHITEBOARD_COLLABORATION_ENABLED === 'true';
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const toast = useToast();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const applyingRemoteScene = useRef(false);
  const queueRef = useRef<TeamWhiteboardSaveQueue | null>(null);
  const socketRef = useRef<Socket<
    WhiteboardServerToClientEvents,
    WhiteboardClientToServerEvents
  > | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [collaborationState, setCollaborationState] = useState<CollaborationState>(
    enabled ? 'connecting' : 'offline',
  );
  const [members, setMembers] = useState<WhiteboardCollaborationMember[]>([]);
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
        socketRef.current?.disconnect();
      };
    }
    const applyScene = async (scene: WhiteboardScene) => {
      const api = apiRef.current;
      if (!api) {
        return;
      }
      const restored = await restoreScene(scene);
      applyingRemoteScene.current = true;
      api.updateScene({
        appState: restored.appState ?? undefined,
        elements: restored.elements ?? [],
      });
      queueMicrotask(() => {
        applyingRemoteScene.current = false;
      });
    };
    const applyPresence = (presenceMembers: WhiteboardCollaborationMember[]) => {
      setMembers(presenceMembers);
      apiRef.current?.updateScene({ collaborators: toCollaborators(presenceMembers) });
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
    socket.on('presence', applyPresence);
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
      applyPresence(baseline.members);
      setCanWrite(baseline.canWrite && props.canEdit);
      queueRef.current?.dispose();
      void (async () => {
        await applyScene(baseline.scene);
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
      queueRef.current?.dispose();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, props.canEdit, props.document.id]);

  let status: React.ReactNode = (
    <span className="text-xs text-ink-faint">团队白板（协作已关闭）</span>
  );
  if (enabled) {
    status = members.length > 0 ? <WhiteboardPresence members={members} /> : null;
  }

  return (
    <WhiteboardCanvasFrame
      nestBesideExcalidrawMenu={isEditable}
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
      status={status}
      canvas={
        <div className="h-full min-h-0">
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
                queueRef.current?.enqueue(createWhiteboardScene({ appState, elements }));
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
              socketRef.current?.emit('presence', {
                button: payload.button,
                x: payload.pointer.x,
                y: payload.pointer.y,
              });
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
