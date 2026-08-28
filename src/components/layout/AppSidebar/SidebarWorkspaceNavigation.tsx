'use client';

import { FileText, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import { moveDocument } from '@/features/documents/server/MoveDocument';
import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';
import type { Project, ProjectArea } from '@/features/projects/Project';
import type { Workspace } from '@/features/workspaces/Workspace';
import { emptyNavigationNodeState, getNavigationNodeKey } from './SidebarDocumentNavigationState';
import { SidebarWorkspaceSectionNavigation } from './SidebarDocumentTree';
import { SidebarNavigationDialogs, useSidebarNavigationDialogs } from './SidebarNavigationDialogs';
import type { WorkspaceProject, WorkspaceSection } from './SidebarWorkspaceNavigationTypes';
import {
  getDocumentMoveTargetParentId,
  useDocumentNavigationDragAndDrop,
} from './useDocumentNavigationDragAndDrop';
import type { DocumentMoveIntent } from './useDocumentNavigationDragAndDrop';
import { useSidebarDocumentNavigation } from './useSidebarDocumentNavigation';

/**
 * Displays personal and collaboration project navigation.
 *
 * @param props - Current route and navigation behavior.
 * @returns The collapsible workspace navigation.
 */
export function SidebarWorkspaceNavigation(props: {
  activeWorkspace: Workspace | null;
  pathname: string;
  projects: Project[];
  onCreateProject: (area: ProjectArea) => void;
  onNavigate: () => void;
  onNavigationDocumentsChange: (documents: DocumentNavigationItem[]) => void;
  onOpenPermissionOverview: (input: PermissionOverviewInput) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDocumentId = searchParams.get('document') ?? undefined;
  const selectedProjectId = searchParams.get('project') ?? undefined;
  const {
    documents,
    expandedDocIds,
    expandedProjectIds,
    expandedSections,
    loadDocumentChildren,
    nodeStates,
    reloadDocumentChildren,
    setExpandedDocIds,
    setExpandedProjectIds,
    setExpandedSections,
  } = useSidebarDocumentNavigation({
    onDocumentsChange: props.onNavigationDocumentsChange,
    projects: props.projects,
    selectedDocumentId,
    selectedProjectId,
  });
  const dialogs = useSidebarNavigationDialogs();

  const refreshMovedNodes = (options: {
    sourceParentId: string | null;
    sourceProjectId: string;
    targetParentId: string | null;
    targetProjectId: string;
  }) => {
    reloadDocumentChildren(options.sourceProjectId, options.sourceParentId);
    if (
      options.sourceProjectId !== options.targetProjectId ||
      options.sourceParentId !== options.targetParentId
    ) {
      reloadDocumentChildren(options.targetProjectId, options.targetParentId);
    }
  };

  const moveDraggedDocument = async (intent: DocumentMoveIntent) => {
    const targetProjectId = intent.targetProject.id;
    const targetParentId =
      intent.kind === 'project'
        ? null
        : getDocumentMoveTargetParentId({
            position: intent.position,
            targetDocumentId: intent.targetDocument.id,
            targetDocumentParentId: intent.targetDocument.parentId,
          });

    await moveDocument({
      documentId: intent.source.documentId,
      ...(intent.kind === 'document'
        ? { position: intent.position, targetDocumentId: intent.targetDocument.id }
        : {}),
      targetParentId,
      targetProjectId,
    });
    if (targetParentId) {
      setExpandedDocIds((current) => ({ ...current, [targetParentId]: true }));
    }
    setExpandedProjectIds((current) => ({ ...current, [targetProjectId]: true }));
    refreshMovedNodes({
      sourceParentId: intent.source.parentId,
      sourceProjectId: intent.source.projectId,
      targetParentId,
      targetProjectId,
    });
  };

  const dragAndDrop = useDocumentNavigationDragAndDrop({ onMove: moveDraggedDocument });

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
              documents: documents
                .filter((document) => document.projectId === project.id)
                .map((document) => ({
                  href: `/personal?project=${project.id}&document=${document.id}`,
                  id: document.id,
                  hasChildren: document.hasChildren,
                  kind: document.kind,
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
                    documents: documents
                      .filter((document) => document.projectId === project.id)
                      .map((document) => ({
                        href: `/collaboration?project=${project.id}&document=${document.id}`,
                        id: document.id,
                        hasChildren: document.hasChildren,
                        kind: document.kind,
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
    setExpandedProjectIds((current) => ({ ...current, [project.id]: true }));
    dialogs.openCreateDocument(project);
  };

  const createChildDocument = (
    project: WorkspaceProject,
    parentDocument: { id: string; label: string },
  ) => {
    setExpandedProjectIds((current) => ({ ...current, [project.id]: true }));
    setExpandedDocIds((current) => ({ ...current, [parentDocument.id]: true }));
    dialogs.openCreateChildDocument(project, parentDocument);
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
          <SidebarWorkspaceSectionNavigation
            key={section.href}
            dragAndDrop={dragAndDrop}
            expandedDocumentIds={expandedDocIds}
            expandedProjectIds={expandedProjectIds}
            isExpanded={expandedSections[section.id]}
            nodeStates={nodeStates}
            pathname={props.pathname}
            section={section}
            selectedDocumentId={selectedDocumentId}
            selectedProjectId={selectedProjectId}
            onCreate={() => {
              setExpandedSections((current) => ({ ...current, [section.id]: true }));
              props.onCreateProject(section.id);
            }}
            onCreateChildDocument={createChildDocument}
            onCreateDocument={createDocumentForProject}
            onLoadMore={(projectId, parentId) => {
              void loadDocumentChildren(projectId, parentId);
            }}
            onNavigate={props.onNavigate}
            onOpenContextMenu={dialogs.openContextMenu}
            onToggle={() => {
              setExpandedSections((current) => ({
                ...current,
                [section.id]: !current[section.id],
              }));
            }}
            onToggleDocument={(projectId, documentId) => {
              const willExpand = !expandedDocIds[documentId];
              setExpandedDocIds((current) => ({
                ...current,
                [documentId]: !current[documentId],
              }));
              const nodeState =
                nodeStates[getNavigationNodeKey(projectId, documentId)] ?? emptyNavigationNodeState;
              if (willExpand && !nodeState.hasLoadedFirstPage) {
                void loadDocumentChildren(projectId, documentId);
              }
            }}
            onToggleProject={(projectId) => {
              const willExpand = !expandedProjectIds[projectId];
              setExpandedProjectIds((current) => ({
                ...current,
                [projectId]: !current[projectId],
              }));
              const nodeState =
                nodeStates[getNavigationNodeKey(projectId, null)] ?? emptyNavigationNodeState;
              if (willExpand && !nodeState.hasLoadedFirstPage) {
                void loadDocumentChildren(projectId, null);
              }
            }}
          />
        ))}
      </div>

      <SidebarNavigationDialogs
        controller={dialogs}
        sections={workspaceSections}
        onDocumentCreated={(href, documentId) => {
          router.push(`${href}&document=${documentId}`);
          props.onNavigate();
        }}
        onDocumentMoved={(input) => {
          router.push(`${input.href}&document=${input.documentId}`);
          refreshMovedNodes(input);
          props.onNavigate();
        }}
        onOpenPermissionOverview={props.onOpenPermissionOverview}
      />
    </>
  );
}
