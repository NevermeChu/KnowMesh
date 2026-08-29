'use client';

import dynamic from 'next/dynamic';
import type { Document, DocumentEditorMode } from '../Document';
import { CollaborativeDocumentEditor } from './CollaborativeDocumentEditor';
import { DocumentEditor } from './DocumentEditor';

const DynamicWhiteboardEditor = dynamic(
  async () => {
    Reflect.set(window, 'EXCALIDRAW_ASSET_PATH', '/excalidraw-assets/');
    const mod = await import('@/features/whiteboards/components/WhiteboardEditor');
    return { default: mod.WhiteboardEditor };
  },
  {
    loading: () => <div className="min-h-0 flex-1 animate-pulse bg-card" />,
    ssr: false,
  },
);

export function DocumentEditorDispatcher(props: {
  canEdit: boolean;
  currentUserId: string;
  document: Document;
  editorMode: DocumentEditorMode | null;
  workspaceKind: 'personal' | 'team';
}) {
  if (props.document.kind === 'whiteboard') {
    return (
      <DynamicWhiteboardEditor
        canEdit={props.canEdit}
        document={props.document}
        workspaceKind={props.workspaceKind}
      />
    );
  }

  if (!props.editorMode) {
    throw new Error('Document editor mode is missing');
  }

  if (props.editorMode === 'collaborative') {
    return (
      <CollaborativeDocumentEditor
        canEdit={props.canEdit}
        currentUserId={props.currentUserId}
        document={props.document}
      />
    );
  }

  return (
    <DocumentEditor
      canEditContent={props.editorMode === 'single-user' && props.canEdit}
      canEditTitle={props.canEdit}
      document={props.document}
    />
  );
}
