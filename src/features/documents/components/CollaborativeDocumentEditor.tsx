'use client';

import { HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
  useHocuspocusAwareness,
  useHocuspocusConnectionStatus,
  useHocuspocusEvent,
  useHocuspocusProvider,
  useHocuspocusSyncStatus,
} from '@hocuspocus/provider-react';
import type { Editor } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Env } from '@/libs/Env';
import { throttleDocumentCollaborationCursorAwareness } from '../collaboration/DocumentCollaborationAwarenessThrottle';
import { parseDocumentCollaborationPersistenceMessage } from '../collaboration/DocumentCollaborationPersistenceMessage';
import { getDocumentCollaborationRoom } from '../collaboration/DocumentCollaborationRoom';
import { parseDocumentCollaborationTitleMessage } from '../collaboration/DocumentCollaborationTitleMessage';
import type { Document } from '../Document';
import { documentExtensions } from '../DocumentExtensions';
import {
  getDocumentCollaborationCanEdit,
  getDocumentCollaborationCanEditTitle,
  getDocumentCollaborationMembers,
  getDocumentCollaborationState,
} from './DocumentCollaborationClientState';
import { getCollaborativeDocumentExtensions } from './DocumentEditorExtensions';
import { DocumentEditorSkeleton } from './DocumentEditorSkeleton';
import { DocumentEditorSurface } from './DocumentEditorSurface';
import { useDocumentEditorToolbarRegistration } from './DocumentEditorToolbar';
import type { DocumentCollaborationMember } from './DocumentPresence';
import type { CollaborationState, SaveState } from './DocumentSaveStatus';
import { DocumentSaveStatus } from './DocumentSaveStatus';

const WEBSOCKET_DESTROY_DELAY_MS = 50;

function DocumentCollaborationConnection(props: { children: React.ReactNode }) {
  const [websocketProvider] = useState(
    () =>
      new HocuspocusProviderWebsocket({
        url: Env.NEXT_PUBLIC_COLLABORATION_URL,
      }),
  );
  const destroyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (destroyTimeout.current) {
      clearTimeout(destroyTimeout.current);
      destroyTimeout.current = null;
    }

    return () => {
      destroyTimeout.current = setTimeout(() => {
        websocketProvider.destroy();
      }, WEBSOCKET_DESTROY_DELAY_MS);
    };
  }, [websocketProvider]);

  return (
    <HocuspocusProviderWebsocketComponent websocketProvider={websocketProvider}>
      {props.children}
    </HocuspocusProviderWebsocketComponent>
  );
}

function CollaborativeDocumentEditorContent(props: {
  canEdit: boolean;
  collaborationMembers: DocumentCollaborationMember[];
  collaborationState: CollaborationState;
  document: Document;
}) {
  const provider = useHocuspocusProvider();
  const toolbarRegistration = useDocumentEditorToolbarRegistration();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [wordCount, setWordCount] = useState(0);
  const registeredEditor = useRef<Editor | null>(null);
  useEffect(
    () =>
      provider.awareness
        ? throttleDocumentCollaborationCursorAwareness(provider.awareness)
        : undefined,
    [provider],
  );
  useHocuspocusEvent('stateless', (data) => {
    const message = parseDocumentCollaborationPersistenceMessage(data.payload);
    if (message) {
      setSaveState(message.status);
    }
  });
  useHocuspocusEvent('unsyncedChanges', (data) => {
    if (data.number > 0) {
      setSaveState('saving');
    }
  });
  const editor = useEditor({
    editable: props.canEdit,
    editorProps: {
      attributes: {
        class: 'min-h-[32rem] px-1 pb-32 pt-4 text-[15px] leading-7 text-ink outline-none',
      },
    },
    extensions: getCollaborativeDocumentExtensions({
      document: provider.document,
      provider,
    }),
    immediatelyRender: false,
    onCreate: ({ editor: createdEditor }) => {
      registeredEditor.current = createdEditor;
      setWordCount(createdEditor.state.doc.textContent.length);
      toolbarRegistration.registerEditor(createdEditor);
    },
    onDestroy: () => {
      if (registeredEditor.current) {
        toolbarRegistration.unregisterEditor(registeredEditor.current);
        registeredEditor.current = null;
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      setWordCount(currentEditor.state.doc.textContent.length);
    },
  });
  useLayoutEffect(() => {
    editor?.setEditable(props.canEdit, false);
  }, [editor, props.canEdit]);

  return (
    <DocumentEditorSurface
      canEditContent={props.canEdit}
      canEditTitle={props.canEdit}
      collaborationMembers={props.collaborationMembers}
      collaborationState={props.collaborationState}
      document={props.document}
      editor={editor}
      saveState={saveState}
      setSaveState={setSaveState}
      wordCount={wordCount}
    />
  );
}

function CollaborativeDocumentSnapshot(props: {
  canEditTitle: boolean;
  collaborationState: CollaborationState;
  document: Document;
}) {
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [wordCount, setWordCount] = useState(0);
  const editor = useEditor({
    content: props.document.content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'min-h-[32rem] px-1 pb-32 pt-4 text-[15px] leading-7 text-ink outline-none',
      },
    },
    extensions: documentExtensions,
    immediatelyRender: false,
    onCreate: ({ editor: createdEditor }) => {
      setWordCount(createdEditor.state.doc.textContent.length);
    },
  });

  return (
    <DocumentEditorSurface
      canEditContent={false}
      canEditTitle={props.canEditTitle}
      collaborationState={props.collaborationState}
      document={props.document}
      editor={editor}
      saveState={saveState}
      setSaveState={setSaveState}
      wordCount={wordCount}
    />
  );
}

function DocumentCollaborationRoom(props: { canEdit: boolean; document: Document }) {
  const provider = useHocuspocusProvider();
  const router = useRouter();
  const connectionStatus = useHocuspocusConnectionStatus();
  const syncStatus = useHocuspocusSyncStatus();
  const users = useHocuspocusAwareness();
  const [authenticationFailed, setAuthenticationFailed] = useState(false);
  const [serverCanEdit, setServerCanEdit] = useState(() =>
    provider.isAuthenticated && provider.authorizedScope
      ? getDocumentCollaborationCanEdit({
          canEdit: props.canEdit,
          scope: provider.authorizedScope,
        })
      : false,
  );
  const [hasDisconnected, setHasDisconnected] = useState(false);
  const [hasSynced, setHasSynced] = useState(provider.isSynced);
  const [documentTitle, setDocumentTitle] = useState(() => ({
    title: props.document.title,
    titleVersion: props.document.titleVersion,
  }));
  useEffect(() => {
    setDocumentTitle((current) =>
      props.document.titleVersion > current.titleVersion
        ? { title: props.document.title, titleVersion: props.document.titleVersion }
        : current,
    );
  }, [props.document.title, props.document.titleVersion]);

  useHocuspocusEvent('authenticated', (data) => {
    setAuthenticationFailed(false);
    setServerCanEdit(
      getDocumentCollaborationCanEdit({ canEdit: props.canEdit, scope: data.scope }),
    );
  });
  useHocuspocusEvent('authenticationFailed', () => {
    setAuthenticationFailed(true);
    setServerCanEdit(false);
  });
  useHocuspocusEvent('close', () => {
    setHasDisconnected(true);
    setServerCanEdit(false);
  });
  useHocuspocusEvent('disconnect', () => {
    setHasDisconnected(true);
    setServerCanEdit(false);
  });
  useHocuspocusEvent('synced', () => {
    setHasSynced(true);
  });
  useHocuspocusEvent('stateless', (data) => {
    const message = parseDocumentCollaborationTitleMessage(data.payload);
    if (!message || message.documentId !== props.document.id) {
      return;
    }

    setDocumentTitle((current) =>
      message.titleVersion > current.titleVersion
        ? { title: message.title, titleVersion: message.titleVersion }
        : current,
    );
    router.refresh();
  });

  const collaborationState = getDocumentCollaborationState({
    authenticationFailed,
    connectionStatus,
    hasDisconnected,
    syncStatus,
  });
  const currentDocument = { ...props.document, ...documentTitle };

  if (!hasSynced) {
    if (authenticationFailed || hasDisconnected) {
      return (
        <CollaborativeDocumentSnapshot
          canEditTitle={getDocumentCollaborationCanEditTitle({
            authenticationFailed,
            canEdit: props.canEdit,
          })}
          collaborationState={collaborationState}
          document={currentDocument}
        />
      );
    }

    return (
      <div className="relative">
        <DocumentEditorSkeleton />
        <div className="absolute top-8 left-0">
          <DocumentSaveStatus
            canEdit={serverCanEdit}
            collaborationState={collaborationState}
            state="saved"
          />
        </div>
      </div>
    );
  }

  return (
    <CollaborativeDocumentEditorContent
      canEdit={serverCanEdit}
      collaborationMembers={getDocumentCollaborationMembers(users)}
      collaborationState={collaborationState}
      document={currentDocument}
    />
  );
}

export function CollaborativeDocumentEditor(props: { canEdit: boolean; document: Document }) {
  return (
    <DocumentCollaborationConnection>
      <HocuspocusRoom name={getDocumentCollaborationRoom(props.document.id)}>
        <DocumentCollaborationRoom canEdit={props.canEdit} document={props.document} />
      </HocuspocusRoom>
    </DocumentCollaborationConnection>
  );
}
