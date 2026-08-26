'use client';

import { useState } from 'react';
import type { WorkspaceDocument, WorkspaceProject } from './SidebarWorkspaceNavigationTypes';

export type DraggingDocument = {
  documentId: string;
  label: string;
  parentId: string | null;
  projectId: string;
};

export type DocumentDropPosition = 'before' | 'inside' | 'after';

export type DocumentDropTarget = {
  id: string;
  kind: 'document' | 'project';
  position: DocumentDropPosition;
};

export type DocumentMoveIntent =
  | {
      kind: 'document';
      position: DocumentDropPosition;
      source: DraggingDocument;
      targetDocument: WorkspaceDocument;
      targetProject: WorkspaceProject;
    }
  | {
      kind: 'project';
      source: DraggingDocument;
      targetProject: WorkspaceProject;
    };

export function isDocumentDescendant(options: {
  ancestorId: string;
  documents: WorkspaceDocument[];
  targetId: string;
}): boolean {
  if (options.targetId === options.ancestorId) {
    return true;
  }
  const documentsById = new Map(options.documents.map((document) => [document.id, document]));
  let current = documentsById.get(options.targetId);
  const visited = new Set<string>();
  while (current?.parentId) {
    if (current.parentId === options.ancestorId) {
      return true;
    }
    if (visited.has(current.parentId)) {
      break;
    }
    visited.add(current.parentId);
    current = documentsById.get(current.parentId);
  }
  return false;
}

export function getDocumentDropPosition(options: {
  clientY: number;
  height: number;
  top: number;
}): DocumentDropPosition {
  const offsetY = options.clientY - options.top;
  if (offsetY < options.height * 0.25) {
    return 'before';
  }
  if (offsetY > options.height * 0.75) {
    return 'after';
  }
  return 'inside';
}

export const getDocumentMoveTargetParentId = (options: {
  position: DocumentDropPosition;
  targetDocumentId: string;
  targetDocumentParentId: string | null;
}) => (options.position === 'inside' ? options.targetDocumentId : options.targetDocumentParentId);

export function useDocumentNavigationDragAndDrop(props: {
  onMove: (intent: DocumentMoveIntent) => Promise<void>;
}) {
  const [draggingDocument, setDraggingDocument] = useState<DraggingDocument | null>(null);
  const [dropTarget, setDropTarget] = useState<DocumentDropTarget | null>(null);

  const reset = () => {
    setDraggingDocument(null);
    setDropTarget(null);
  };

  const onDragStartDocument = (
    event: React.DragEvent<HTMLElement>,
    document: WorkspaceDocument,
    project: WorkspaceProject,
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData('text/plain', document.id);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingDocument({
      documentId: document.id,
      label: document.label,
      parentId: document.parentId,
      projectId: project.id,
    });
  };

  const onDragOverDocument = (
    event: React.DragEvent<HTMLElement>,
    targetDocument: WorkspaceDocument,
    targetProject: WorkspaceProject,
  ) => {
    if (!draggingDocument || draggingDocument.documentId === targetDocument.id) {
      return;
    }
    if (
      draggingDocument.projectId === targetProject.id &&
      isDocumentDescendant({
        ancestorId: draggingDocument.documentId,
        documents: targetProject.documents,
        targetId: targetDocument.id,
      })
    ) {
      return;
    }
    if (
      draggingDocument.projectId !== targetProject.id &&
      !targetProject.permissions.includes('document.create')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const rectangle = event.currentTarget.getBoundingClientRect();
    const position = getDocumentDropPosition({
      clientY: event.clientY,
      height: rectangle.height,
      top: rectangle.top,
    });
    if (
      dropTarget?.id !== targetDocument.id ||
      dropTarget.kind !== 'document' ||
      dropTarget.position !== position
    ) {
      setDropTarget({ id: targetDocument.id, kind: 'document', position });
    }
  };

  const onDragLeaveDocument = (
    event: React.DragEvent<HTMLElement>,
    document: WorkspaceDocument,
  ) => {
    event.stopPropagation();
    if (dropTarget?.kind === 'document' && dropTarget.id === document.id) {
      setDropTarget(null);
    }
  };

  const onDropDocument = async (
    event: React.DragEvent<HTMLElement>,
    targetDocument: WorkspaceDocument,
    targetProject: WorkspaceProject,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (
      !draggingDocument ||
      dropTarget?.kind !== 'document' ||
      dropTarget.id !== targetDocument.id
    ) {
      reset();
      return;
    }

    const intent: DocumentMoveIntent = {
      kind: 'document',
      position: dropTarget.position,
      source: draggingDocument,
      targetDocument,
      targetProject,
    };
    reset();
    try {
      await props.onMove(intent);
    } catch {
      // The tree is not updated optimistically, so failed moves require no rollback.
    }
  };

  const onDragOverProject = (event: React.DragEvent<HTMLElement>, project: WorkspaceProject) => {
    if (!draggingDocument || !project.permissions.includes('document.create')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (dropTarget?.kind !== 'project' || dropTarget.id !== project.id) {
      setDropTarget({ id: project.id, kind: 'project', position: 'inside' });
    }
  };

  const onDragLeaveProject = (event: React.DragEvent<HTMLElement>, project: WorkspaceProject) => {
    event.stopPropagation();
    if (dropTarget?.kind === 'project' && dropTarget.id === project.id) {
      setDropTarget(null);
    }
  };

  const onDropProject = async (
    event: React.DragEvent<HTMLElement>,
    targetProject: WorkspaceProject,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingDocument || dropTarget?.kind !== 'project' || dropTarget.id !== targetProject.id) {
      reset();
      return;
    }

    const intent: DocumentMoveIntent = {
      kind: 'project',
      source: draggingDocument,
      targetProject,
    };
    reset();
    try {
      await props.onMove(intent);
    } catch {
      // The tree is not updated optimistically, so failed moves require no rollback.
    }
  };

  return {
    draggingDocument,
    dropTarget,
    onDragEndDocument: reset,
    onDragLeaveDocument,
    onDragLeaveProject,
    onDragOverDocument,
    onDragOverProject,
    onDragStartDocument,
    onDropDocument,
    onDropProject,
  };
}

export type DocumentNavigationDragAndDrop = ReturnType<typeof useDocumentNavigationDragAndDrop>;
