'use client';

import type { Document, DocumentEditorMode } from '../Document';
import { CollaborativeDocumentEditor } from './CollaborativeDocumentEditor';
import { DocumentEditor } from './DocumentEditor';

export function DocumentEditorDispatcher(props: {
  canEdit: boolean;
  document: Document;
  editorMode: DocumentEditorMode;
}) {
  if (props.editorMode === 'collaborative') {
    return <CollaborativeDocumentEditor canEdit={props.canEdit} document={props.document} />;
  }

  return (
    <DocumentEditor
      canEditContent={props.editorMode === 'single-user' && props.canEdit}
      canEditTitle={props.canEdit}
      document={props.document}
    />
  );
}
