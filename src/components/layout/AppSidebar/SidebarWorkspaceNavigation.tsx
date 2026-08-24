'use client';

import { ChevronRight, FileText, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SidebarNavigationContextMenus } from '@/components/layout/AppSidebar/SidebarNavigationContextMenus';
import type {
  NavigationContextMenu,
  NavigationContextTarget,
  WorkspaceDocument,
  WorkspaceProject,
  WorkspaceSection,
} from '@/components/layout/AppSidebar/SidebarWorkspaceNavigationTypes';
import { fitContextMenuPosition } from '@/components/ui/ContextMenu';
import { CreateDocumentDialog } from '@/features/documents/components/CreateDocumentDialog';
import { MoveDocumentDialog } from '@/features/documents/components/MoveDocumentDialog';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import { moveDocument } from '@/features/documents/server/MoveDocument';
import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';
import type { Project, ProjectArea } from '@/features/projects/Project';
import type { Workspace } from '@/features/workspaces/Workspace';

const isActiveRoute = (pathname: string, href: string) => pathname.startsWith(href);

type DraggingDocument = {
  documentId: string;
  label: string;
  parentId: string | null;
  projectId: string;
};

type DropTargetState = {
  id: string;
  kind: 'document' | 'project';
  position: 'before' | 'inside' | 'after';
};

function isDescendant(
  targetId: string,
  ancestorId: string,
  documents: WorkspaceDocument[],
): boolean {
  if (targetId === ancestorId) {
    return true;
  }
  const docMap = new Map(documents.map((doc) => [doc.id, doc]));
  let current = docMap.get(targetId);
  const visited = new Set<string>();
  while (current?.parentId) {
    if (current.parentId === ancestorId) {
      return true;
    }
    if (visited.has(current.parentId)) {
      break;
    }
    visited.add(current.parentId);
    current = docMap.get(current.parentId);
  }
  return false;
}

function buildDocumentTree(documents: WorkspaceDocument[]): WorkspaceDocument[] {
  const docMap = new Map<string, WorkspaceDocument>();
  const rootDocs: WorkspaceDocument[] = [];

  for (const doc of documents) {
    docMap.set(doc.id, { ...doc, children: [] });
  }

  for (const doc of documents) {
    const treeNode = docMap.get(doc.id);
    if (!treeNode) {
      continue;
    }

    if (doc.parentId && docMap.has(doc.parentId)) {
      docMap.get(doc.parentId)?.children?.push(treeNode);
    } else {
      rootDocs.push(treeNode);
    }
  }

  return rootDocs;
}

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
  isDocExpanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  if (props.hasChildren) {
    return (
      <button
        type="button"
        aria-label={props.isDocExpanded ? `收起${props.label}` : `展开${props.label}`}
        className="grid size-6 shrink-0 place-items-center rounded text-ink-faint transition-colors hover:bg-overlay-strong hover:text-ink"
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle();
        }}
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-3 transition-transform duration-200 ${props.isDocExpanded ? 'rotate-90' : ''}`}
          strokeWidth={1.8}
        />
      </button>
    );
  }

  return (
    <span className="grid size-6 shrink-0 place-items-center text-ink-faint">
      <FileText aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
    </span>
  );
}

function DocumentTreeItem(props: {
  depth: number;
  document: WorkspaceDocument;
  draggingDoc: DraggingDocument | null;
  dropTarget: DropTargetState | null;
  expandedDocIds: Record<string, boolean>;
  onCreateChildDocument: (
    project: WorkspaceProject,
    parentDocument: { id: string; label: string },
  ) => void;
  onDragEndDoc: () => void;
  onDragLeaveDoc: (event: React.DragEvent<HTMLElement>, doc: WorkspaceDocument) => void;
  onDragOverDoc: (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => void;
  onDragStartDoc: (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => void;
  onDropDoc: (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => void;
  onNavigate: () => void;
  onOpenContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    target: NavigationContextTarget,
  ) => void;
  onToggleDoc: (docId: string) => void;
  project: WorkspaceProject;
  selectedDocumentId?: string;
}) {
  const hasChildren = (props.document.children?.length ?? 0) > 0;
  const isDocumentActive = props.selectedDocumentId === props.document.id;
  const isDocExpanded = props.expandedDocIds[props.document.id] ?? false;
  const isDraggingThis = props.draggingDoc?.documentId === props.document.id;
  const isDropTargetThis = props.dropTarget?.id === props.document.id;
  const canDrag = props.project.permissions.includes('document.update');

  const containerClassName = getDocumentItemClassName({
    dropPosition: props.dropTarget?.position,
    isDocumentActive,
    isDraggingThis,
    isDropTargetThis,
  });

  return (
    <li>
      <div
        draggable={canDrag}
        className={containerClassName}
        style={{ paddingLeft: `${props.depth * 12 + 6}px` }}
        onContextMenu={(event) => {
          props.onOpenContextMenu(event, {
            document: props.document,
            kind: 'document',
            project: props.project,
          });
        }}
        onDragStart={(event) => {
          if (!canDrag) {
            return;
          }
          props.onDragStartDoc(event, props.document, props.project);
        }}
        onDragOver={(event) => {
          props.onDragOverDoc(event, props.document, props.project);
        }}
        onDragLeave={(event) => {
          props.onDragLeaveDoc(event, props.document);
        }}
        onDrop={(event) => {
          props.onDropDoc(event, props.document, props.project);
        }}
        onDragEnd={props.onDragEndDoc}
      >
        {isDocumentActive && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r-full bg-accent"
          />
        )}

        <DocumentTreePrefix
          hasChildren={hasChildren}
          isDocExpanded={isDocExpanded}
          label={props.document.label}
          onToggle={() => {
            props.onToggleDoc(props.document.id);
          }}
        />

        <Link
          href={props.document.href}
          aria-current={isDocumentActive ? 'page' : undefined}
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

      {hasChildren && isDocExpanded && (
        <ul className="mt-0.5 space-y-0.5">
          {props.document.children?.map((child) => (
            <DocumentTreeItem
              key={child.id}
              depth={props.depth + 1}
              document={child}
              draggingDoc={props.draggingDoc}
              dropTarget={props.dropTarget}
              expandedDocIds={props.expandedDocIds}
              onCreateChildDocument={props.onCreateChildDocument}
              onDragEndDoc={props.onDragEndDoc}
              onDragLeaveDoc={props.onDragLeaveDoc}
              onDragOverDoc={props.onDragOverDoc}
              onDragStartDoc={props.onDragStartDoc}
              onDropDoc={props.onDropDoc}
              onNavigate={props.onNavigate}
              onOpenContextMenu={props.onOpenContextMenu}
              onToggleDoc={props.onToggleDoc}
              project={props.project}
              selectedDocumentId={props.selectedDocumentId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function WorkspaceSectionNavigation(props: {
  draggingDoc: DraggingDocument | null;
  dropTarget: DropTargetState | null;
  expandedDocIds: Record<string, boolean>;
  expandedProjectIds: Record<string, boolean>;
  isExpanded: boolean;
  onCreate: () => void;
  onCreateChildDocument: (
    project: WorkspaceProject,
    parentDocument: { id: string; label: string },
  ) => void;
  onCreateDocument: (project: WorkspaceProject) => void;
  onDragEndDoc: () => void;
  onDragLeaveDoc: (event: React.DragEvent<HTMLElement>, doc: WorkspaceDocument) => void;
  onDragLeaveProject: (event: React.DragEvent<HTMLElement>, project: WorkspaceProject) => void;
  onDragOverDoc: (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => void;
  onDragOverProject: (event: React.DragEvent<HTMLElement>, project: WorkspaceProject) => void;
  onDragStartDoc: (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => void;
  onDropDoc: (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => void;
  onDropProject: (event: React.DragEvent<HTMLElement>, project: WorkspaceProject) => void;
  onNavigate: () => void;
  onOpenContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    target: NavigationContextTarget,
  ) => void;
  onToggle: () => void;
  onToggleDoc: (docId: string) => void;
  onToggleProject: (projectId: string) => void;
  pathname: string;
  selectedDocumentId?: string;
  selectedProjectId?: string;
  section: WorkspaceSection;
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
          aria-expanded={props.isExpanded}
          aria-current={isActive ? 'page' : undefined}
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
                const isProjectActive =
                  isActiveRoute(props.pathname, props.section.href) &&
                  props.selectedProjectId === project.id;
                const isProjectExpanded = props.expandedProjectIds[project.id] ?? false;
                const isProjectDropTarget =
                  props.dropTarget?.id === project.id && props.dropTarget?.kind === 'project';
                const documentTree = buildDocumentTree(project.documents);

                return (
                  <li key={project.id}>
                    <div
                      className={getProjectItemClassName({ isProjectActive, isProjectDropTarget })}
                      onContextMenu={(event) => {
                        props.onOpenContextMenu(event, { kind: 'project', project });
                      }}
                      onDragOver={(event) => {
                        props.onDragOverProject(event, project);
                      }}
                      onDragLeave={(event) => {
                        props.onDragLeaveProject(event, project);
                      }}
                      onDrop={(event) => {
                        props.onDropProject(event, project);
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
                          {documentTree.length === 0 ? (
                            <li className="px-3 py-1 text-xs text-ink-faint">暂无文档</li>
                          ) : (
                            documentTree.map((document) => (
                              <DocumentTreeItem
                                key={document.id}
                                depth={0}
                                document={document}
                                draggingDoc={props.draggingDoc}
                                dropTarget={props.dropTarget}
                                expandedDocIds={props.expandedDocIds}
                                onCreateChildDocument={props.onCreateChildDocument}
                                onDragEndDoc={props.onDragEndDoc}
                                onDragLeaveDoc={props.onDragLeaveDoc}
                                onDragOverDoc={props.onDragOverDoc}
                                onDragStartDoc={props.onDragStartDoc}
                                onDropDoc={props.onDropDoc}
                                onNavigate={props.onNavigate}
                                onOpenContextMenu={props.onOpenContextMenu}
                                onToggleDoc={props.onToggleDoc}
                                project={project}
                                selectedDocumentId={props.selectedDocumentId}
                              />
                            ))
                          )}
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

/**
 * Displays personal and collaboration project navigation.
 *
 * @param props - Current route and navigation behavior.
 * @returns The collapsible workspace navigation.
 */
export function SidebarWorkspaceNavigation(props: {
  activeWorkspace: Workspace | null;
  documents: DocumentNavigationItem[];
  pathname: string;
  projects: Project[];
  onCreateProject: (area: ProjectArea) => void;
  onNavigate: () => void;
  onOpenPermissionOverview: (input: PermissionOverviewInput) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDocumentId = searchParams.get('document') ?? undefined;
  const selectedProjectId = searchParams.get('project') ?? undefined;
  const selectedProjectArea = props.projects.find(
    (project) => project.id === selectedProjectId,
  )?.workspaceKind;

  const [expandedSections, setExpandedSections] = useState<Record<ProjectArea, boolean>>({
    collaboration: selectedProjectArea === 'team',
    personal: selectedProjectArea === 'personal',
  });
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>(
    selectedProjectId ? { [selectedProjectId]: true } : {},
  );

  // Expand parent documents if selectedDocumentId has ancestors
  const initialExpandedDocIds: Record<string, boolean> = {};
  if (selectedDocumentId) {
    const docById = new Map(props.documents.map((doc) => [doc.id, doc]));
    let currentDoc = docById.get(selectedDocumentId);
    while (currentDoc?.parentId) {
      initialExpandedDocIds[currentDoc.parentId] = true;
      currentDoc = docById.get(currentDoc.parentId);
    }
  }

  const [expandedDocIds, setExpandedDocIds] =
    useState<Record<string, boolean>>(initialExpandedDocIds);
  const [contextMenu, setContextMenu] = useState<NavigationContextMenu | null>(null);
  const [creatingDocumentProject, setCreatingDocumentProject] = useState<WorkspaceProject | null>(
    null,
  );
  const [creatingChildDocument, setCreatingChildDocument] = useState<{
    parentDocument: { id: string; label: string };
    project: WorkspaceProject;
  } | null>(null);
  const [movingDocument, setMovingDocument] = useState<{
    document: WorkspaceDocument;
    project: WorkspaceProject;
  } | null>(null);
  const [draggingDoc, setDraggingDoc] = useState<DraggingDocument | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);

  const handleDragStartDoc = (
    event: React.DragEvent<HTMLElement>,
    doc: WorkspaceDocument,
    project: WorkspaceProject,
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData('text/plain', doc.id);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingDoc({
      documentId: doc.id,
      label: doc.label,
      parentId: doc.parentId,
      projectId: project.id,
    });
  };

  const handleDragEndDoc = () => {
    setDraggingDoc(null);
    setDropTarget(null);
  };

  const handleDragOverDoc = (
    event: React.DragEvent<HTMLElement>,
    targetDoc: WorkspaceDocument,
    targetProject: WorkspaceProject,
  ) => {
    if (!draggingDoc || draggingDoc.documentId === targetDoc.id) {
      return;
    }

    if (draggingDoc.projectId === targetProject.id) {
      if (isDescendant(targetDoc.id, draggingDoc.documentId, targetProject.documents)) {
        return;
      }
    } else if (!targetProject.permissions.includes('document.create')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const { height } = rect;

    let position: 'before' | 'inside' | 'after';
    if (offsetY < height * 0.25) {
      position = 'before';
    } else if (offsetY > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }

    if (!dropTarget || dropTarget.id !== targetDoc.id || dropTarget.position !== position) {
      setDropTarget({ id: targetDoc.id, kind: 'document', position });
    }
  };

  const handleDragLeaveDoc = (event: React.DragEvent<HTMLElement>, doc: WorkspaceDocument) => {
    event.stopPropagation();
    if (dropTarget?.id === doc.id) {
      setDropTarget(null);
    }
  };

  const handleDropDoc = async (
    event: React.DragEvent<HTMLElement>,
    targetDoc: WorkspaceDocument,
    targetProject: WorkspaceProject,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!draggingDoc || !dropTarget || dropTarget.id !== targetDoc.id) {
      setDraggingDoc(null);
      setDropTarget(null);
      return;
    }

    const { position } = dropTarget;
    const sourceDocId = draggingDoc.documentId;
    const targetProjectId = targetProject.id;
    setDraggingDoc(null);
    setDropTarget(null);

    let targetParentId: string | null = null;
    let sortOrder: number | undefined;

    if (position === 'inside') {
      targetParentId = targetDoc.id;
    } else {
      targetParentId = targetDoc.parentId;
      const siblings = targetProject.documents
        .filter((doc) => doc.parentId === targetParentId && doc.id !== sourceDocId)
        .toSorted((a, b) => a.sortOrder - b.sortOrder);

      const targetIdx = siblings.findIndex((doc) => doc.id === targetDoc.id);
      if (targetIdx !== -1) {
        if (position === 'before') {
          const prev = siblings[targetIdx - 1];
          sortOrder = prev
            ? (prev.sortOrder + targetDoc.sortOrder) / 2
            : targetDoc.sortOrder - 1000;
        } else {
          const next = siblings[targetIdx + 1];
          sortOrder = next
            ? (targetDoc.sortOrder + next.sortOrder) / 2
            : targetDoc.sortOrder + 1000;
        }
      }
    }

    try {
      await moveDocument({
        documentId: sourceDocId,
        sortOrder,
        targetParentId,
        targetProjectId,
      });
      if (targetParentId) {
        setExpandedDocIds((prev) => ({ ...prev, [targetParentId]: true }));
      }
      setExpandedProjectIds((prev) => ({ ...prev, [targetProjectId]: true }));
      router.refresh();
    } catch {
      // Silently catch or handle move failure
    }
  };

  const handleDragOverProject = (
    event: React.DragEvent<HTMLElement>,
    project: WorkspaceProject,
  ) => {
    if (!draggingDoc) {
      return;
    }
    if (!project.permissions.includes('document.create')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    if (!dropTarget || dropTarget.id !== project.id) {
      setDropTarget({ id: project.id, kind: 'project', position: 'inside' });
    }
  };

  const handleDragLeaveProject = (
    event: React.DragEvent<HTMLElement>,
    project: WorkspaceProject,
  ) => {
    event.stopPropagation();
    if (dropTarget?.id === project.id) {
      setDropTarget(null);
    }
  };

  const handleDropProject = async (
    event: React.DragEvent<HTMLElement>,
    project: WorkspaceProject,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!draggingDoc || !dropTarget || dropTarget.id !== project.id) {
      setDraggingDoc(null);
      setDropTarget(null);
      return;
    }

    const sourceDocId = draggingDoc.documentId;
    const targetProjectId = project.id;
    setDraggingDoc(null);
    setDropTarget(null);

    try {
      await moveDocument({
        documentId: sourceDocId,
        targetParentId: null,
        targetProjectId,
      });
      setExpandedProjectIds((prev) => ({ ...prev, [targetProjectId]: true }));
      router.refresh();
    } catch {
      // Silently catch or handle move failure
    }
  };

  const workspaceSections: WorkspaceSection[] = props.activeWorkspace
    ? [
        {
          href: '/personal',
          canCreateProject: true,
          id: 'personal',
          icon: FileText,
          label: '个人区域',
          projects: props.projects
            .filter((project) => project.workspaceKind === 'personal')
            .map((project) => ({
              documents: props.documents
                .filter((document) => document.projectId === project.id)
                .map((document) => ({
                  href: `/personal?project=${project.id}&document=${document.id}`,
                  id: document.id,
                  label: document.title,
                  parentId: document.parentId,
                  sortOrder: document.sortOrder,
                })),
              href: `/personal?project=${project.id}`,
              id: project.id,
              label: project.name,
              permissions: project.permissions,
            })),
        },
        ...(props.activeWorkspace.kind === 'team'
          ? [
              {
                href: '/collaboration',
                canCreateProject: props.activeWorkspace.permissions.includes('project.create'),
                id: 'collaboration',
                icon: Users,
                label: '协作区域',
                projects: props.projects
                  .filter((project) => project.workspaceKind === 'team')
                  .map((project) => ({
                    documents: props.documents
                      .filter((document) => document.projectId === project.id)
                      .map((document) => ({
                        href: `/collaboration?project=${project.id}&document=${document.id}`,
                        id: document.id,
                        label: document.title,
                        parentId: document.parentId,
                        sortOrder: document.sortOrder,
                      })),
                    href: `/collaboration?project=${project.id}`,
                    id: project.id,
                    label: project.name,
                    permissions: project.permissions,
                  })),
              } satisfies WorkspaceSection,
            ]
          : []),
      ]
    : [];

  const createDocumentForProject = (project: WorkspaceProject) => {
    setExpandedProjectIds((currentProjects) => ({ ...currentProjects, [project.id]: true }));
    setCreatingDocumentProject(project);
  };

  const createChildDocument = (
    project: WorkspaceProject,
    parentDocument: { id: string; label: string },
  ) => {
    setExpandedProjectIds((currentProjects) => ({ ...currentProjects, [project.id]: true }));
    setExpandedDocIds((currentDocs) => ({ ...currentDocs, [parentDocument.id]: true }));
    setCreatingChildDocument({ parentDocument, project });
  };

  return (
    <>
      <div className="mt-7 space-y-3">
        {!props.activeWorkspace && (
          <p className="px-2 text-xs leading-5 text-ink-faint">
            创建或选择工作区后，这里会显示个人与协作项目。
          </p>
        )}
        {workspaceSections.map((section) => (
          <WorkspaceSectionNavigation
            key={section.href}
            draggingDoc={draggingDoc}
            dropTarget={dropTarget}
            expandedDocIds={expandedDocIds}
            expandedProjectIds={expandedProjectIds}
            isExpanded={expandedSections[section.id]}
            pathname={props.pathname}
            selectedDocumentId={selectedDocumentId}
            selectedProjectId={selectedProjectId}
            section={section}
            onCreate={() => {
              setExpandedSections((currentSections) => ({
                ...currentSections,
                [section.id]: true,
              }));
              props.onCreateProject(section.id);
            }}
            onCreateChildDocument={createChildDocument}
            onCreateDocument={createDocumentForProject}
            onDragEndDoc={handleDragEndDoc}
            onDragLeaveDoc={handleDragLeaveDoc}
            onDragLeaveProject={handleDragLeaveProject}
            onDragOverDoc={handleDragOverDoc}
            onDragOverProject={handleDragOverProject}
            onDragStartDoc={handleDragStartDoc}
            onDropDoc={handleDropDoc}
            onDropProject={handleDropProject}
            onNavigate={props.onNavigate}
            onOpenContextMenu={(event, target) => {
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
            }}
            onToggle={() => {
              setExpandedSections((currentSections) => ({
                ...currentSections,
                [section.id]: !currentSections[section.id],
              }));
            }}
            onToggleDoc={(docId) => {
              setExpandedDocIds((currentDocs) => ({
                ...currentDocs,
                [docId]: !currentDocs[docId],
              }));
            }}
            onToggleProject={(projectId) => {
              setExpandedProjectIds((currentProjects) => ({
                ...currentProjects,
                [projectId]: !currentProjects[projectId],
              }));
            }}
          />
        ))}
        <SidebarNavigationContextMenus
          contextMenu={contextMenu}
          onClose={() => {
            setContextMenu(null);
          }}
          onCreateChildDocument={createChildDocument}
          onCreateDocument={createDocumentForProject}
          onMoveDocument={(project, doc) => {
            setMovingDocument({ document: doc, project });
          }}
          onOpenPermissionOverview={props.onOpenPermissionOverview}
        />
      </div>

      {creatingDocumentProject && (
        <CreateDocumentDialog
          projectId={creatingDocumentProject.id}
          projectName={creatingDocumentProject.label}
          onClose={() => {
            setCreatingDocumentProject(null);
          }}
          onCreated={(documentId) => {
            router.push(`${creatingDocumentProject.href}&document=${documentId}`);
            setCreatingDocumentProject(null);
            props.onNavigate();
          }}
        />
      )}

      {creatingChildDocument && (
        <CreateDocumentDialog
          parentDocument={{
            id: creatingChildDocument.parentDocument.id,
            title: creatingChildDocument.parentDocument.label,
          }}
          projectId={creatingChildDocument.project.id}
          projectName={creatingChildDocument.project.label}
          onClose={() => {
            setCreatingChildDocument(null);
          }}
          onCreated={(documentId) => {
            router.push(`${creatingChildDocument.project.href}&document=${documentId}`);
            setCreatingChildDocument(null);
            props.onNavigate();
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
            workspaceSections.find((section) =>
              section.projects.some((p) => p.id === movingDocument.project.id),
            )?.projects ?? [movingDocument.project]
          }
          onClose={() => {
            setMovingDocument(null);
          }}
          onMoved={(targetProjectId, documentId) => {
            const targetProject = workspaceSections
              .flatMap((s) => s.projects)
              .find((p) => p.id === targetProjectId);
            const href = targetProject
              ? `${targetProject.href}&document=${documentId}`
              : `${movingDocument.project.href}&document=${documentId}`;
            router.push(href);
            router.refresh();
            setMovingDocument(null);
            props.onNavigate();
          }}
        />
      )}
    </>
  );
}
