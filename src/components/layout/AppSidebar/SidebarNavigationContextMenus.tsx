import { ArrowRightLeft, FilePlus, Settings } from 'lucide-react';
import { ContextMenu } from '@/components/ui/ContextMenu';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';
import type {
  NavigationContextMenu,
  WorkspaceDocument,
  WorkspaceProject,
} from './SidebarWorkspaceNavigationTypes';

/**
 * Renders project and document navigation menus.
 *
 * @param props - Selected resource and navigation actions.
 * @returns The active context menu and optional permission overview.
 */
export function SidebarNavigationContextMenus(props: {
  contextMenu: NavigationContextMenu | null;
  onClose: () => void;
  onCreateChildDocument: (
    project: WorkspaceProject,
    parentDocument: { id: string; label: string },
  ) => void;
  onCreateDocument: (project: WorkspaceProject) => void;
  onMoveDocument: (project: WorkspaceProject, document: WorkspaceDocument) => void;
  onOpenPermissionOverview: (input: PermissionOverviewInput) => void;
}) {
  const contextMenuItems: ContextMenuItem[] = (() => {
    if (!props.contextMenu) {
      return [];
    }

    const { target } = props.contextMenu;

    if (target.kind === 'project') {
      return [
        {
          icon: <Settings aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
          label: '管理项目',
          onSelect: () => {
            props.onOpenPermissionOverview({ projectId: target.project.id, scope: 'project' });
          },
        },
        {
          disabled: !target.project.permissions.includes('document.create'),
          icon: <FilePlus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
          label: '新建文件',
          onSelect: () => {
            props.onCreateDocument(target.project);
          },
        },
      ];
    }

    return [
      {
        icon: <Settings aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
        label: '管理文件',
        onSelect: () => {
          props.onOpenPermissionOverview({ documentId: target.document.id, scope: 'document' });
        },
      },
      {
        disabled: !target.project.permissions.includes('document.create'),
        icon: <FilePlus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
        label: '新建子文件',
        onSelect: () => {
          props.onCreateChildDocument(target.project, {
            id: target.document.id,
            label: target.document.label,
          });
        },
      },
      {
        disabled: !target.project.permissions.includes('document.update'),
        icon: <ArrowRightLeft aria-hidden="true" className="size-3.5" strokeWidth={1.8} />,
        label: '移动文件',
        onSelect: () => {
          props.onMoveDocument(target.project, target.document);
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
