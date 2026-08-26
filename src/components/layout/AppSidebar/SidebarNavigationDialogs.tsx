'use client';

import { useState } from 'react';
import { fitContextMenuPosition } from '@/components/ui/ContextMenu';
import { CreateDocumentDialog } from '@/features/documents/components/CreateDocumentDialog';
import { MoveDocumentDialog } from '@/features/documents/components/MoveDocumentDialog';
import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';
import { SidebarNavigationContextMenus } from './SidebarNavigationContextMenus';
import type {
  NavigationContextMenu,
  NavigationContextTarget,
  WorkspaceDocument,
  WorkspaceProject,
  WorkspaceSection,
} from './SidebarWorkspaceNavigationTypes';

type NavigationDialogState =
  | { type: 'closed' }
  | { project: WorkspaceProject; type: 'createDocument' }
  | {
      parentDocument: { id: string; label: string };
      project: WorkspaceProject;
      type: 'createChildDocument';
    }
  | { document: WorkspaceDocument; project: WorkspaceProject; type: 'moveDocument' };

export function useSidebarNavigationDialogs() {
  const [contextMenu, setContextMenu] = useState<NavigationContextMenu | null>(null);
  const [dialog, setDialog] = useState<NavigationDialogState>({ type: 'closed' });

  return {
    closeContextMenu: () => {
      setContextMenu(null);
    },
    closeDialog: () => {
      setDialog({ type: 'closed' });
    },
    contextMenu,
    dialog,
    openContextMenu: (event: React.MouseEvent<HTMLElement>, target: NavigationContextTarget) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        position: fitContextMenuPosition({
          itemCount: target.kind === 'document' ? 3 : 2,
          x: event.clientX,
          y: event.clientY,
        }),
        target,
      });
    },
    openCreateChildDocument: (
      project: WorkspaceProject,
      parentDocument: { id: string; label: string },
    ) => {
      setDialog({ parentDocument, project, type: 'createChildDocument' });
    },
    openCreateDocument: (project: WorkspaceProject) => {
      setDialog({ project, type: 'createDocument' });
    },
    openMoveDocument: (project: WorkspaceProject, document: WorkspaceDocument) => {
      setDialog({ document, project, type: 'moveDocument' });
    },
  };
}

export type SidebarNavigationDialogsController = ReturnType<typeof useSidebarNavigationDialogs>;

export function SidebarNavigationDialogs(props: {
  controller: SidebarNavigationDialogsController;
  onDocumentCreated: (href: string, documentId: string) => void;
  onDocumentMoved: (input: {
    documentId: string;
    href: string;
    sourceParentId: string | null;
    sourceProjectId: string;
    targetParentId: string | null;
    targetProjectId: string;
  }) => void;
  onOpenPermissionOverview: (input: PermissionOverviewInput) => void;
  sections: WorkspaceSection[];
}) {
  const movingDocument =
    props.controller.dialog.type === 'moveDocument' ? props.controller.dialog : null;

  return (
    <>
      <SidebarNavigationContextMenus
        contextMenu={props.controller.contextMenu}
        onClose={props.controller.closeContextMenu}
        onCreateChildDocument={props.controller.openCreateChildDocument}
        onCreateDocument={props.controller.openCreateDocument}
        onMoveDocument={props.controller.openMoveDocument}
        onOpenPermissionOverview={props.onOpenPermissionOverview}
      />

      {props.controller.dialog.type === 'createDocument' && (
        <CreateDocumentDialog
          projectId={props.controller.dialog.project.id}
          projectName={props.controller.dialog.project.label}
          onClose={props.controller.closeDialog}
          onCreated={(documentId) => {
            const href = props.controller.dialog;
            if (href.type !== 'createDocument') {
              return;
            }
            props.controller.closeDialog();
            props.onDocumentCreated(href.project.href, documentId);
          }}
        />
      )}

      {props.controller.dialog.type === 'createChildDocument' && (
        <CreateDocumentDialog
          parentDocument={{
            id: props.controller.dialog.parentDocument.id,
            title: props.controller.dialog.parentDocument.label,
          }}
          projectId={props.controller.dialog.project.id}
          projectName={props.controller.dialog.project.label}
          onClose={props.controller.closeDialog}
          onCreated={(documentId) => {
            const currentDialog = props.controller.dialog;
            if (currentDialog.type !== 'createChildDocument') {
              return;
            }
            props.controller.closeDialog();
            props.onDocumentCreated(currentDialog.project.href, documentId);
          }}
        />
      )}

      {movingDocument && (
        <MoveDocumentDialog
          currentProject={movingDocument.project}
          document={{
            id: movingDocument.document.id,
            label: movingDocument.document.label,
            parentId: movingDocument.document.parentId,
          }}
          projects={
            props.sections.find((section) =>
              section.projects.some((project) => project.id === movingDocument.project.id),
            )?.projects ?? [movingDocument.project]
          }
          onClose={props.controller.closeDialog}
          onMoved={(targetProjectId, targetParentId, documentId) => {
            const targetProject = props.sections
              .flatMap((section) => section.projects)
              .find((project) => project.id === targetProjectId);
            props.controller.closeDialog();
            props.onDocumentMoved({
              documentId,
              href: targetProject?.href ?? movingDocument.project.href,
              sourceParentId: movingDocument.document.parentId,
              sourceProjectId: movingDocument.project.id,
              targetParentId,
              targetProjectId,
            });
          }}
        />
      )}
    </>
  );
}
