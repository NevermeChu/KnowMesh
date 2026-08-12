'use client';

import { ChevronRight, FileText, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SidebarNavigationContextMenus } from '@/components/layout/AppSidebar/SidebarNavigationContextMenus';
import type {
  NavigationContextMenu,
  NavigationContextTarget,
  WorkspaceProject,
  WorkspaceSection,
} from '@/components/layout/AppSidebar/SidebarWorkspaceNavigationTypes';
import { fitContextMenuPosition } from '@/components/ui/ContextMenu';
import { CreateDocumentDialog } from '@/features/documents/components/CreateDocumentDialog';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import type { PermissionOverviewInput } from '@/features/projects/PermissionOverview';
import type { Project, ProjectArea } from '@/features/projects/Project';
import type { Workspace } from '@/features/workspaces/Workspace';

const isActiveRoute = (pathname: string, href: string) => pathname.startsWith(href);

function WorkspaceSectionNavigation(props: {
  isExpanded: boolean;
  expandedProjectIds: Record<string, boolean>;
  onCreate: () => void;
  onCreateDocument: (project: WorkspaceProject) => void;
  onNavigate: () => void;
  onOpenContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    target: NavigationContextTarget,
  ) => void;
  onToggle: () => void;
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
        className={`flex min-h-9 items-center rounded-lg transition-colors ${
          isActive
            ? 'bg-black/7 text-[#202124]'
            : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
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
          className="grid size-8 shrink-0 place-items-center rounded-md text-[#8a8d91] transition-colors hover:bg-black/7 hover:text-[#202124]"
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
          className="grid size-8 shrink-0 place-items-center rounded-md text-[#8a8d91] transition-colors hover:bg-black/7 hover:text-[#202124]"
          onClick={props.onToggle}
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-4 transition-transform ${props.isExpanded ? 'rotate-90' : ''}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      {props.isExpanded && (
        <ul id={`workspace-projects-${props.section.id}`} className="mt-1 space-y-1 pl-5">
          {props.section.projects.length === 0 ? (
            <li className="px-3 py-1.5 text-xs text-[#9a9da1]">暂无项目</li>
          ) : (
            props.section.projects.map((project) => {
              const isProjectActive =
                isActiveRoute(props.pathname, props.section.href) &&
                props.selectedProjectId === project.id;
              const isProjectExpanded = props.expandedProjectIds[project.id] ?? false;

              return (
                <li key={project.id}>
                  <div
                    className={`flex min-h-8 items-center rounded-lg transition-colors ${
                      isProjectActive
                        ? 'bg-black/7 text-[#202124]'
                        : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
                    }`}
                    onContextMenu={(event) => {
                      props.onOpenContextMenu(event, { kind: 'project', project });
                    }}
                  >
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
                        className="grid size-8 shrink-0 place-items-center rounded-md text-[#8a8d91] transition-colors hover:bg-black/7 hover:text-[#202124]"
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
                      className="grid size-8 shrink-0 place-items-center rounded-md text-[#8a8d91] transition-colors hover:bg-black/7 hover:text-[#202124]"
                      onClick={() => {
                        props.onToggleProject(project.id);
                      }}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={`size-3.5 transition-transform ${isProjectExpanded ? 'rotate-90' : ''}`}
                        strokeWidth={1.8}
                      />
                    </button>
                  </div>

                  {isProjectExpanded && (
                    <ul id={`project-documents-${project.id}`} className="mt-1 space-y-1 pl-3">
                      {project.documents.length === 0 ? (
                        <li className="px-3 py-1 text-xs text-[#9a9da1]">暂无文档</li>
                      ) : (
                        project.documents.map((document) => {
                          const isDocumentActive = props.selectedDocumentId === document.id;

                          return (
                            <li key={document.id}>
                              <Link
                                href={document.href}
                                aria-current={isDocumentActive ? 'page' : undefined}
                                className={`flex min-h-8 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                  isDocumentActive
                                    ? 'bg-black/7 font-medium text-[#202124]'
                                    : 'text-[#777b80] hover:bg-black/5 hover:text-[#202124]'
                                }`}
                                onClick={props.onNavigate}
                                onContextMenu={(event) => {
                                  props.onOpenContextMenu(event, {
                                    document,
                                    kind: 'document',
                                    project,
                                  });
                                }}
                              >
                                <FileText
                                  aria-hidden="true"
                                  className="size-3.5 shrink-0"
                                  strokeWidth={1.8}
                                />
                                <span className="truncate">{document.label}</span>
                              </Link>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
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
  const [contextMenu, setContextMenu] = useState<NavigationContextMenu | null>(null);
  const [creatingDocumentProject, setCreatingDocumentProject] = useState<WorkspaceProject | null>(
    null,
  );
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

  return (
    <>
      <div className="mt-7 space-y-3">
        {!props.activeWorkspace && (
          <p className="px-2 text-xs leading-5 text-[#8a8d91]">
            创建或选择工作区后，这里会显示个人与协作项目。
          </p>
        )}
        {workspaceSections.map((section) => (
          <WorkspaceSectionNavigation
            key={section.href}
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
            onCreateDocument={createDocumentForProject}
            onNavigate={props.onNavigate}
            onOpenContextMenu={(event, target) => {
              event.preventDefault();
              event.stopPropagation();
              setContextMenu({
                position: fitContextMenuPosition({
                  itemCount: 2,
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
          onCreateDocument={createDocumentForProject}
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
    </>
  );
}
