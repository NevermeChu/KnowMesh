'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, FileText, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type WorkspaceProject = {
  href: string;
  label: string;
};

type WorkspaceSectionId = 'collaboration' | 'personal';

type WorkspaceSection = {
  href: string;
  id: WorkspaceSectionId;
  icon: LucideIcon;
  label: string;
  projects: WorkspaceProject[];
};

const workspaceSections: WorkspaceSection[] = [
  {
    href: '/personal',
    id: 'personal',
    icon: FileText,
    label: '个人工作区',
    projects: [],
  },
  {
    href: '/collaboration',
    id: 'collaboration',
    icon: Users,
    label: '协作区',
    projects: [],
  },
];

const isActiveRoute = (pathname: string, href: string) => pathname.startsWith(href);

function WorkspaceSectionNavigation(props: {
  isExpanded: boolean;
  onNavigate: () => void;
  onToggle: () => void;
  pathname: string;
  section: WorkspaceSection;
}) {
  const Icon = props.section.icon;
  const isActive = isActiveRoute(props.pathname, props.section.href);

  return (
    <nav aria-label={props.section.label}>
      <button
        type="button"
        aria-controls={`workspace-projects-${props.section.id}`}
        aria-expanded={props.isExpanded}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-h-9 w-full items-center gap-3 rounded-lg px-1.5 text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-black/7 text-[#202124]'
            : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
        }`}
        onClick={props.onToggle}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
        <span>{props.section.label}</span>
        <ChevronRight
          aria-hidden="true"
          className={`ml-auto size-4 shrink-0 transition-transform ${props.isExpanded ? 'rotate-90' : ''}`}
          strokeWidth={1.8}
        />
      </button>

      {props.isExpanded && (
        <ul id={`workspace-projects-${props.section.id}`} className="mt-1 space-y-1 pl-5">
          {props.section.projects.length === 0 ? (
            <li className="px-3 py-1.5 text-xs text-[#9a9da1]">暂无项目</li>
          ) : (
            props.section.projects.map((project) => {
              const isProjectActive = isActiveRoute(props.pathname, project.href);

              return (
                <li key={project.href}>
                  <Link
                    href={project.href}
                    aria-current={isProjectActive ? 'page' : undefined}
                    className={`block min-h-8 truncate rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isProjectActive
                        ? 'bg-black/7 text-[#202124]'
                        : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
                    }`}
                    onClick={props.onNavigate}
                  >
                    {project.label}
                  </Link>
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
export function SidebarWorkspaceNavigation(props: { pathname: string; onNavigate: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<WorkspaceSectionId, boolean>>({
    collaboration: false,
    personal: false,
  });

  return (
    <div className="mt-7 space-y-3">
      {workspaceSections.map((section) => (
        <WorkspaceSectionNavigation
          key={section.href}
          isExpanded={expandedSections[section.id]}
          pathname={props.pathname}
          section={section}
          onNavigate={props.onNavigate}
          onToggle={() => {
            setExpandedSections((currentSections) => ({
              ...currentSections,
              [section.id]: !currentSections[section.id],
            }));
          }}
        />
      ))}
    </div>
  );
}
