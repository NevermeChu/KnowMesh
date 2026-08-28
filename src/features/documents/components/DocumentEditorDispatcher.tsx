'use client';

import dynamic from 'next/dynamic';
import type { Document, DocumentEditorMode } from '../Document';
import { CollaborativeDocumentEditor } from './CollaborativeDocumentEditor';
import { DocumentEditor } from './DocumentEditor';

const DynamicReadonlyWhiteboard = dynamic(
  async () => {
    const mod = await import('@/features/whiteboards/components/ReadonlyWhiteboard');
    return { default: mod.ReadonlyWhiteboard };
  },
  { loading: () => <div className="min-h-[32rem] animate-pulse rounded-xl bg-card" /> },
);

export function DocumentEditorDispatcher(props: {
  canEdit: boolean;
  currentUserId: string;
  document: Document;
  editorMode: DocumentEditorMode | null;
}) {
  if (props.document.kind === 'whiteboard') {
    return <DynamicReadonlyWhiteboard document={props.document} />;
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
