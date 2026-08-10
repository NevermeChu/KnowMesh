'use client';

import { FilePlus, FolderPlus, Settings } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { ContextMenu } from '@/components/ui/ContextMenu';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import { canEditDocuments } from '@/features/documents/Document';
import { PermissionOverviewDialog } from '@/features/projects/components/PermissionOverviewDialog';
import type {
  PermissionOverview,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';
import { isSamePermissionOverviewInput } from '@/features/projects/PermissionOverview';
import { getPermissionOverview } from '@/features/projects/server/GetPermissionOverview';
import type { NavigationContextMenu, WorkspaceProject } from './SidebarWorkspaceNavigationTypes';

/**
 * Renders resource-specific navigation menus and their permission dialog.
 *
 * @param props - Selected resource and navigation actions.
 * @returns The active context menu and optional permission overview.
 */
export function SidebarNavigationContextMenus(props: {
  contextMenu: NavigationContextMenu | null;
  onClose: () => void;
  onCreateDocument: (project: WorkspaceProject) => void;
  onCreateProject: (kind: 'personal' | 'collaboration') => void;
}) {
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [permissionOverview, setPermissionOverview] = useState<PermissionOverview | null>(null);
  const [permissionInput, setPermissionInput] = useState<PermissionOverviewInput | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoadingPermissions, startLoadingPermissions] = useTransition();
  const permissionRequestId = useRef(0);

  const openPermissionOverview = (input: PermissionOverviewInput) => {
    if (isPermissionDialogOpen && isSamePermissionOverviewInput(permissionInput, input)) {
      return;
    }

    const requestId = permissionRequestId.current + 1;
    permissionRequestId.current = requestId;
    setIsPermissionDialogOpen(true);
    setPermissionInput(input);
    setPermissionOverview(null);
    setPermissionError(null);
    startLoadingPermissions(async () => {
      try {
        const overview = await getPermissionOverview(input);

        if (permissionRequestId.current === requestId) {
          setPermissionOverview(overview);
        }
      } catch {
        if (permissionRequestId.current === requestId) {
          setPermissionError('权限列表加载失败，请稍后重试');
        }
      }
    });
  };

  const contextMenuItems: ContextMenuItem[] = (() => {
    if (!props.contextMenu) {
      return [];
    }

    const { target } = props.contextMenu;

    if (target.kind === 'workspace') {
      return [
        {
          icon: <Settings aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
          label: '管理工作区',
          onSelect: () => {
            openPermissionOverview({ kind: target.section.id, scope: 'workspace' });
          },
        },
        {
          icon: <FolderPlus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
          label: '新建项目',
          onSelect: () => {
            props.onCreateProject(target.section.id);
          },
        },
      ];
    }

    return [
      {
        icon: <Settings aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
        label: target.kind === 'project' ? '管理项目' : '管理文件',
        onSelect: () => {
          if (target.kind === 'project') {
            openPermissionOverview({ projectId: target.project.id, scope: 'project' });
          } else {
            openPermissionOverview({ documentId: target.document.id, scope: 'document' });
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

    if (props.contextMenu.target.kind === 'workspace') {
      return props.contextMenu.target.section.label;
    }

    if (props.contextMenu.target.kind === 'project') {
      return props.contextMenu.target.project.label;
    }

    return props.contextMenu.target.document.label;
  })();

  return (
    <>
      <ContextMenu
        id="navigation-context-menu"
        items={contextMenuItems}
        label={contextMenuLabel}
        position={props.contextMenu?.position ?? null}
        onClose={props.onClose}
      />
      {isPermissionDialogOpen && (
        <PermissionOverviewDialog
          error={permissionError}
          isLoading={isLoadingPermissions}
          overview={permissionOverview}
          onClose={() => {
            permissionRequestId.current += 1;
            setIsPermissionDialogOpen(false);
          }}
          onNavigate={openPermissionOverview}
        />
      )}
    </>
  );
}
