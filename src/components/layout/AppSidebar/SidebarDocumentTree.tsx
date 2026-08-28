import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { DocumentKindIcon } from '@/features/documents/components/DocumentKindIcon';
import {
  buildDocumentTree,
  emptyNavigationNodeState,
  getNavigationNodeKey,
} from './SidebarDocumentNavigationState';
import type { NavigationNodeState } from './SidebarDocumentNavigationState';
import type {
  NavigationContextTarget,
  WorkspaceDocument,
  WorkspaceProject,
  WorkspaceSection,
} from './SidebarWorkspaceNavigationTypes';
import type { DocumentNavigationDragAndDrop } from './useDocumentNavigationDragAndDrop';

const isActiveRoute = (pathname: string, href: string) => pathname.startsWith(href);

function getDocumentItemClassName(options: {
  dropPosition?: 'before' | 'inside' | 'after';
  isDocumentActive: boolean;
  isDraggingThis: boolean;
  isDropTargetThis: boolean;
}): string {
  const classes = [
    'group relative flex min-h-8 items-center gap-1 rounded-lg pr-1 transition-colors',
  ];
  if (options.isDraggingThis) {
    classes.push('opacity-40');
  }
  if (options.isDropTargetThis && options.dropPosition === 'inside') {
    classes.push('bg-accent-soft/60 ring-1 ring-accent');
  } else if (options.isDocumentActive) {
    classes.push('bg-accent-soft font-medium text-accent');
  } else {
    classes.push('text-ink-muted hover:bg-overlay hover:text-ink');
  }
  if (options.isDropTargetThis && options.dropPosition === 'before') {
    classes.push(
      'before:absolute before:top-0 before:right-1 before:left-1 before:z-10 before:h-0.5 before:rounded-full before:bg-accent',
    );
  }
  if (options.isDropTargetThis && options.dropPosition === 'after') {
    classes.push(
      'after:absolute after:right-1 after:bottom-0 after:left-1 after:z-10 after:h-0.5 after:rounded-full after:bg-accent',
    );
  }
  return classes.join(' ');
}

function getProjectItemClassName(options: {
  isProjectActive: boolean;
  isProjectDropTarget: boolean;
}): string {
  if (options.isProjectDropTarget) {
    return 'relative flex min-h-8 items-center rounded-lg transition-colors bg-accent-soft/60 ring-1 ring-accent';
  }
  if (options.isProjectActive) {
    return 'relative flex min-h-8 items-center rounded-lg transition-colors bg-accent-soft font-medium text-accent';
  }
  return 'relative flex min-h-8 items-center rounded-lg transition-colors text-ink-muted hover:bg-overlay hover:text-ink';
}

function DocumentTreePrefix(props: {
  hasChildren: boolean;
  isExpanded: boolean;
  kind: WorkspaceDocument['kind'];
  label: string;
  onToggle: () => void;
}) {
  if (!props.hasChildren) {
    return (
      <span className="grid size-6 shrink-0 place-items-center text-ink-faint">
        <DocumentKindIcon className="size-3.5" kind={props.kind} />
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={props.isExpanded ? `收起${props.label}` : `展开${props.label}`}
      className="grid size-6 shrink-0 place-items-center rounded text-ink-faint transition-colors hover:bg-overlay-strong hover:text-ink"
      onClick={(event) => {
        event.stopPropagation();
        props.onToggle();
      }}
    >
      <ChevronRight
        aria-hidden="true"
        className={`size-3 transition-transform duration-200 ${props.isExpanded ? 'rotate-90' : ''}`}
        strokeWidth={1.8}
      />
    </button>
  );
}

type DocumentTreeItemProps = {
  depth: number;
  document: WorkspaceDocument;
  dragAndDrop: DocumentNavigationDragAndDrop;
  expandedDocumentIds: Record<string, boolean>;
  nodeStates: Record<string, NavigationNodeState>;
  onCreateChildDocument: (
    project: WorkspaceProject,
    parentDocument: { id: string; label: string },
  ) => void;
  onLoadMore: (projectId: string, parentId: string | null) => void;
  onNavigate: () => void;
  onOpenContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    target: NavigationContextTarget,
  ) => void;
  onToggleDocument: (projectId: string, documentId: string) => void;
  project: WorkspaceProject;
  selectedDocumentId?: string;
};

function NavigationNodeStatus(props: {
  className: string;
  nodeState: NavigationNodeState;
  onLoadMore: () => void;
}) {
  if (props.nodeState.isLoading) {
    return <li className={`${props.className} py-1 text-xs text-ink-faint`}>正在加载…</li>;
  }
  if (props.nodeState.error) {
    return (
      <li className={`${props.className} py-1 text-xs text-danger`}>
        <button type="button" className="underline underline-offset-2" onClick={props.onLoadMore}>
          加载失败，点击重试
        </button>
      </li>
    );
  }
  if (props.nodeState.nextCursor) {
    return (
      <li className={`${props.className} py-1 text-xs text-ink-faint`}>
        <button
          type="button"
          className="underline underline-offset-2 hover:text-ink"
          onClick={props.onLoadMore}
        >
          加载更多
        </button>
      </li>
    );
  }
  return null;
}

function DocumentTreeItem(props: DocumentTreeItemProps) {
  const isActive = props.selectedDocumentId === props.document.id;
  const isExpanded = props.expandedDocumentIds[props.document.id] ?? false;
  const isDragging = props.dragAndDrop.draggingDocument?.documentId === props.document.id;
  const isDropTarget =
    props.dragAndDrop.dropTarget?.kind === 'document' &&
    props.dragAndDrop.dropTarget.id === props.document.id;
  const canDrag = props.project.permissions.includes('document.update');
  const nodeState =
    props.nodeStates[getNavigationNodeKey(props.project.id, props.document.id)] ??
    emptyNavigationNodeState;

  return (
    <li>
      <div
        draggable={canDrag}
        className={getDocumentItemClassName({
          dropPosition: props.dragAndDrop.dropTarget?.position,
          isDocumentActive: isActive,
          isDraggingThis: isDragging,
          isDropTargetThis: isDropTarget,
        })}
        style={{ paddingLeft: `${props.depth * 12 + 6}px` }}
        onContextMenu={(event) => {
          props.onOpenContextMenu(event, {
            document: props.document,
            kind: 'document',
            project: props.project,
          });
        }}
        onDragStart={(event) => {
          if (canDrag) {
            props.dragAndDrop.onDragStartDocument(event, props.document, props.project);
          }
        }}
        onDragOver={(event) => {
          props.dragAndDrop.onDragOverDocument(event, props.document, props.project);
        }}
        onDragLeave={(event) => {
          props.dragAndDrop.onDragLeaveDocument(event, props.document);
        }}
        onDrop={(event) => {
          void props.dragAndDrop.onDropDocument(event, props.document, props.project);
        }}
        onDragEnd={props.dragAndDrop.onDragEndDocument}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r-full bg-accent"
          />
        )}
        <DocumentTreePrefix
          hasChildren={props.document.hasChildren}
          isExpanded={isExpanded}
          kind={props.document.kind}
          label={props.document.label}
          onToggle={() => {
            props.onToggleDocument(props.project.id, props.document.id);
          }}
        />
        {props.document.hasChildren && (
          <DocumentKindIcon
            className="size-3.5 shrink-0 text-ink-faint"
            kind={props.document.kind}
          />
        )}
        <Link
          href={props.document.href}
          aria-current={isActive ? 'page' : undefined}
          className="min-w-0 flex-1 truncate py-1 text-sm"
          onClick={props.onNavigate}
        >
          {props.document.label}
        </Link>
        {props.project.permissions.includes('document.create') && (
          <button
            type="button"
            aria-label={`在「${props.document.label}」下新建子文件`}
            title="新建子文件"
            className="grid size-6 shrink-0 place-items-center rounded text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-overlay-strong hover:text-ink focus:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              props.onCreateChildDocument(props.project, {
                id: props.document.id,
                label: props.document.label,
              });
            }}
          >
            <Plus aria-hidden="true" className="size-3" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {props.document.hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5">
          {props.document.children?.map((child) => (
            <DocumentTreeItem key={child.id} {...props} depth={props.depth + 1} document={child} />
          ))}
          <NavigationNodeStatus
            className="px-8"
            nodeState={nodeState}
            onLoadMore={() => {
              props.onLoadMore(props.project.id, props.document.id);
            }}
          />
        </ul>
      )}
    </li>
  );
}

export function SidebarWorkspaceSectionNavigation(props: {
  dragAndDrop: DocumentNavigationDragAndDrop;
  expandedDocumentIds: Record<string, boolean>;
  expandedProjectIds: Record<string, boolean>;
  isExpanded: boolean;
  nodeStates: Record<string, NavigationNodeState>;
  onCreate: () => void;
  onCreateChildDocument: DocumentTreeItemProps['onCreateChildDocument'];
  onCreateDocument: (project: WorkspaceProject) => void;
  onLoadMore: DocumentTreeItemProps['onLoadMore'];
  onNavigate: () => void;
  onOpenContextMenu: DocumentTreeItemProps['onOpenContextMenu'];
  onToggle: () => void;
  onToggleDocument: DocumentTreeItemProps['onToggleDocument'];
  onToggleProject: (projectId: string) => void;
  pathname: string;
  section: WorkspaceSection;
  selectedDocumentId?: string;
  selectedProjectId?: string;
}) {
  const Icon = props.section.icon;
  const isActive = isActiveRoute(props.pathname, props.section.href);

  return (
    <nav aria-label={props.section.label}>
      <div
        className={`relative flex min-h-9 items-center rounded-lg transition-colors ${
          isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-overlay hover:text-ink'
        }`}
      >
        <button
          type="button"
          aria-controls={`workspace-projects-${props.section.id}`}
          aria-current={isActive ? 'page' : undefined}
          aria-expanded={props.isExpanded}
          className="flex min-w-0 flex-1 items-center gap-3 self-stretch px-1.5 text-left text-sm font-semibold"
          onClick={props.onToggle}
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
          <span className="truncate">{props.section.label}</span>
        </button>
        <button
          type="button"
          aria-label={`在${props.section.label}中创建项目`}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-overlay-strong hover:text-ink"
          disabled={!props.section.canCreateProject}
          onClick={props.onCreate}
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label={
            props.isExpanded ? `收起${props.section.label}` : `展开${props.section.label}`
          }
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-overlay-strong hover:text-ink"
          onClick={props.onToggle}
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 ${props.isExpanded ? 'rotate-90' : ''}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          props.isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <ul id={`workspace-projects-${props.section.id}`} className="mt-1 space-y-1 pl-5">
            {props.section.projects.length === 0 ? (
              <li className="px-3 py-1.5 text-xs text-ink-faint">暂无项目</li>
            ) : (
              props.section.projects.map((project) => {
                const isProjectActive = isActive && props.selectedProjectId === project.id;
                const isProjectExpanded = props.expandedProjectIds[project.id] ?? false;
                const isProjectDropTarget =
                  props.dragAndDrop.dropTarget?.kind === 'project' &&
                  props.dragAndDrop.dropTarget.id === project.id;
                const documentTree = buildDocumentTree(project.documents);
                const nodeState =
                  props.nodeStates[getNavigationNodeKey(project.id, null)] ??
                  emptyNavigationNodeState;

                return (
                  <li key={project.id}>
                    <div
                      className={getProjectItemClassName({
                        isProjectActive,
                        isProjectDropTarget,
                      })}
                      onContextMenu={(event) => {
                        props.onOpenContextMenu(event, { kind: 'project', project });
                      }}
                      onDragOver={(event) => {
                        props.dragAndDrop.onDragOverProject(event, project);
                      }}
                      onDragLeave={(event) => {
                        props.dragAndDrop.onDragLeaveProject(event, project);
                      }}
                      onDrop={(event) => {
                        void props.dragAndDrop.onDropProject(event, project);
                      }}
                    >
                      {isProjectActive && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r-full bg-accent"
                        />
                      )}
                      <Link
                        href={project.href}
                        aria-current={isProjectActive ? 'page' : undefined}
                        className="min-w-0 flex-1 truncate px-3 py-1.5 text-sm"
                        onClick={() => {
                          if (!isProjectExpanded) {
                            props.onToggleProject(project.id);
                          }
                          props.onNavigate();
                        }}
                      >
                        {project.label}
                      </Link>
                      {isProjectActive && project.permissions.includes('document.create') && (
                        <button
                          type="button"
                          aria-label={`在${project.label}中创建文档`}
                          title="创建文档"
                          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-overlay-strong hover:text-ink"
                          onClick={() => {
                            props.onCreateDocument(project);
                          }}
                        >
                          <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-controls={`project-documents-${project.id}`}
                        aria-expanded={isProjectExpanded}
                        aria-label={
                          isProjectExpanded ? `收起${project.label}` : `展开${project.label}`
                        }
                        className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-overlay-strong hover:text-ink"
                        onClick={() => {
                          props.onToggleProject(project.id);
                        }}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={`size-3.5 transition-transform duration-200 ${isProjectExpanded ? 'rotate-90' : ''}`}
                          strokeWidth={1.8}
                        />
                      </button>
                    </div>

                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                        isProjectExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <ul
                          id={`project-documents-${project.id}`}
                          className="mt-1 space-y-0.5 pl-2"
                        >
                          {documentTree.length === 0 &&
                          nodeState.hasLoadedFirstPage &&
                          !nodeState.isLoading ? (
                            <li className="px-3 py-1 text-xs text-ink-faint">暂无文档</li>
                          ) : (
                            documentTree.map((document) => (
                              <DocumentTreeItem
                                key={document.id}
                                depth={0}
                                document={document}
                                dragAndDrop={props.dragAndDrop}
                                expandedDocumentIds={props.expandedDocumentIds}
                                nodeStates={props.nodeStates}
                                onCreateChildDocument={props.onCreateChildDocument}
                                onLoadMore={props.onLoadMore}
                                onNavigate={props.onNavigate}
                                onOpenContextMenu={props.onOpenContextMenu}
                                onToggleDocument={props.onToggleDocument}
                                project={project}
                                selectedDocumentId={props.selectedDocumentId}
                              />
                            ))
                          )}
                          <NavigationNodeStatus
                            className="px-3"
                            nodeState={nodeState}
                            onLoadMore={() => {
                              props.onLoadMore(project.id, null);
                            }}
                          />
                        </ul>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
