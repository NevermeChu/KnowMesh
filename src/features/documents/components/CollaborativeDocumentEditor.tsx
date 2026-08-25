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
import { IndexeddbPersistence } from 'y-indexeddb';
import { Env } from '@/libs/Env';
import { throttleDocumentCollaborationCursorAwareness } from '../collaboration/DocumentCollaborationAwarenessThrottle';
import { getDocumentCollaborationCacheName } from '../collaboration/DocumentCollaborationLocalPersistence';
import { parseDocumentCollaborationPersistenceMessage } from '../collaboration/DocumentCollaborationPersistenceMessage';
import { getDocumentCollaborationRoom } from '../collaboration/DocumentCollaborationRoom';
import { parseDocumentCollaborationTitleMessage } from '../collaboration/DocumentCollaborationTitleMessage';
import { startDocumentCollaborationWebsocket } from '../collaboration/DocumentCollaborationWebsocketLifecycle';
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

const LOCAL_PERSISTENCE_TIMEOUT_MS = 5000;

type LocalPersistenceState = 'error' | 'loading' | 'ready' | 'skipped';

async function destroyLocalPersistence(persistence: IndexeddbPersistence) {
  try {
    await persistence.destroy();
  } catch {
    // The database may already be closed during browser teardown.
  }
}

function DocumentCollaborationConnection(props: { children: React.ReactNode }) {
  const [websocketProvider, setWebsocketProvider] = useState<HocuspocusProviderWebsocket | null>(
    null,
  );

  useEffect(
    () =>
      startDocumentCollaborationWebsocket({
        create: () =>
          new HocuspocusProviderWebsocket({
            autoConnect: false,
            url: Env.NEXT_PUBLIC_COLLABORATION_URL,
          }),
        onReady: setWebsocketProvider,
      }),
    [],
  );

  if (!websocketProvider) {
    return <DocumentEditorSkeleton />;
  }

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
  localPersistenceFailed: boolean;
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
      localPersistenceFailed={props.localPersistenceFailed}
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

function DocumentCollaborationRoom(props: {
  canEdit: boolean;
  currentUserId: string;
  document: Document;
}) {
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
  const [localPersistenceAllowed, setLocalPersistenceAllowed] = useState<boolean | null>(() =>
    provider.isAuthenticated && provider.authorizedScope
      ? provider.authorizedScope === 'read-write' && props.canEdit
      : null,
  );
  const [hasDisconnected, setHasDisconnected] = useState(false);
  const [hasSynced, setHasSynced] = useState(provider.isSynced);
  const [localPersistenceState, setLocalPersistenceState] =
    useState<LocalPersistenceState>('loading');
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
  useEffect(() => {
    let isActive = true;
    let persistence: IndexeddbPersistence | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const markUnavailable = () => {
      if (!isActive) {
        return;
      }
      console.error('Document collaboration local recovery is unavailable');
      setLocalPersistenceState('error');
    };

    if (localPersistenceAllowed === null) {
      setLocalPersistenceState('loading');
    } else if (!localPersistenceAllowed) {
      setLocalPersistenceState('skipped');
    } else if (typeof indexedDB === 'undefined') {
      markUnavailable();
    } else {
      try {
        persistence = new IndexeddbPersistence(
          getDocumentCollaborationCacheName({
            documentId: props.document.id,
            userId: props.currentUserId,
          }),
          provider.document,
        );
        persistence.once('synced', () => {
          if (!isActive) {
            return;
          }
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          setLocalPersistenceState('ready');
        });
        timeout = setTimeout(markUnavailable, LOCAL_PERSISTENCE_TIMEOUT_MS);
      } catch {
        markUnavailable();
      }
    }

    return () => {
      isActive = false;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (persistence) {
        void destroyLocalPersistence(persistence);
      }
    };
  }, [localPersistenceAllowed, props.currentUserId, props.document.id, provider.document]);

  useHocuspocusEvent('authenticated', (data) => {
    setAuthenticationFailed(false);
    setLocalPersistenceAllowed(data.scope === 'read-write' && props.canEdit);
    setServerCanEdit(
      getDocumentCollaborationCanEdit({ canEdit: props.canEdit, scope: data.scope }),
    );
  });
  useHocuspocusEvent('authenticationFailed', () => {
    setAuthenticationFailed(true);
    setLocalPersistenceAllowed(false);
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

  if (!hasSynced || localPersistenceState === 'loading') {
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
      localPersistenceFailed={localPersistenceState === 'error'}
    />
  );
}

export function CollaborativeDocumentEditor(props: {
  canEdit: boolean;
  currentUserId: string;
  document: Document;
}) {
  return (
    <DocumentCollaborationConnection>
      <HocuspocusRoom name={getDocumentCollaborationRoom(props.document.id)}>
        <DocumentCollaborationRoom
          canEdit={props.canEdit}
          currentUserId={props.currentUserId}
          document={props.document}
        />
      </HocuspocusRoom>
    </DocumentCollaborationConnection>
  );
}
