'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar/AppSidebar';
import { ContentToolbar } from '@/components/layout/ContentToolbar';
import { DocumentEditorToolbarProvider } from '@/features/documents/components/DocumentEditorToolbar';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import type { Project } from '@/features/projects/Project';
import type { Workspace } from '@/features/workspaces/Workspace';

const DEFAULT_SIDEBAR_WIDTH = 190;
const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 360;

type AppShellStyle = React.CSSProperties & {
  '--app-sidebar-width': string;
};

/**
 * Renders the shared shell for authenticated application pages.
 *
 * @param props - Shell content.
 * @returns The authenticated application layout.
 */
export function AppShell(props: {
  activeWorkspace: Workspace | null;
  children: React.ReactNode;
  documents: DocumentNavigationItem[];
  projects: Project[];
  unreadNotificationCount: number;
  workspaces: Workspace[];
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const shellStyle: AppShellStyle = {
    '--app-sidebar-width': `${sidebarWidth}px`,
  };

  return (
    <DocumentEditorToolbarProvider>
      <div className="min-h-dvh bg-canvas text-ink antialiased" style={shellStyle}>
        <AppSidebar
          activeWorkspace={props.activeWorkspace}
          documents={props.documents}
          isHidden={isContentFullscreen}
          projects={props.projects}
          unreadNotificationCount={props.unreadNotificationCount}
          workspaces={props.workspaces}
          width={sidebarWidth}
          onResize={(width) => {
            setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width)));
          }}
        />
        <main
          className={`min-h-dvh pt-16 transition-[margin-left] duration-200 lg:pt-0 ${
            isContentFullscreen ? 'lg:ml-0' : 'lg:ml-[var(--app-sidebar-width)]'
          }`}
        >
          <ContentToolbar
            isContentFullscreen={isContentFullscreen}
            onToggleContentFullscreen={() => {
              setIsContentFullscreen((isFullscreen) => !isFullscreen);
            }}
          />
          <div className="px-5 sm:px-8 lg:px-12">{props.children}</div>
        </main>
      </div>
    </DocumentEditorToolbarProvider>
  );
}
