'use client';

import { FilePlus, Settings } from 'lucide-react';
import { ContextMenu } from '@/components/ui/ContextMenu';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import { canEditDocuments } from '@/features/documents/Document';
import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';
import type { NavigationContextMenu, WorkspaceProject } from './SidebarWorkspaceNavigationTypes';

/**
 * Renders project and document navigation menus.
 *
 * @param props - Selected resource and navigation actions.
 * @returns The active context menu and optional permission overview.
 */
export function SidebarNavigationContextMenus(props: {
  contextMenu: NavigationContextMenu | null;
  onClose: () => void;
  onCreateDocument: (project: WorkspaceProject) => void;
  onOpenPermissionOverview: (input: PermissionOverviewInput) => void;
}) {
  const contextMenuItems: ContextMenuItem[] = (() => {
    if (!props.contextMenu) {
      return [];
    }

    const { target } = props.contextMenu;

    return [
      {
        icon: <Settings aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
        label: target.kind === 'project' ? '管理项目' : '管理文件',
        onSelect: () => {
          if (target.kind === 'project') {
            props.onOpenPermissionOverview({ projectId: target.project.id, scope: 'project' });
          } else {
            props.onOpenPermissionOverview({ documentId: target.document.id, scope: 'document' });
          }
        },
      },
      {
        disabled: !canEditDocuments(target.project.role),
        icon: <FilePlus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
        label: '新建文件',
        onSelect: () => {
          props.onCreateDocument(target.project);
        },
      },
    ];
  })();

  const contextMenuLabel = (() => {
    if (!props.contextMenu) {
      return '';
    }

    if (props.contextMenu.target.kind === 'project') {
      return props.contextMenu.target.project.label;
    }

    return props.contextMenu.target.document.label;
  })();

  return (
    <ContextMenu
      id="navigation-context-menu"
      items={contextMenuItems}
      label={contextMenuLabel}
      position={props.contextMenu?.position ?? null}
      onClose={props.onClose}
    />
  );
}
