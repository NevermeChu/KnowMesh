'use client';

import { useEffect, useRef, useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar/AppSidebar';
import { ContentToolbar } from '@/components/layout/ContentToolbar';
import { TOGGLE_FULLSCREEN_EVENT } from '@/components/layout/ShellEvents';
import { ShortcutsHelpDialog } from '@/components/ui/ShortcutsHelpDialog';
import { DocumentEditorToolbarProvider } from '@/features/documents/components/DocumentEditorToolbar';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import type { ContentWidthPercentage } from '@/features/preferences/Preferences';
import type { Project } from '@/features/projects/Project';
import { CommandPalette } from '@/features/search/components/CommandPalette';
import { KnowMeshWebMcpTools } from '@/features/webmcp/components/KnowMeshWebMcpTools';
import type { Workspace } from '@/features/workspaces/Workspace';

const DEFAULT_SIDEBAR_WIDTH = 190;
const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 360;

const clampSidebarWidth = (width: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));

type AppShellStyle = React.CSSProperties & {
  '--app-sidebar-width': string;
};

/**
 * Renders the shared shell for authenticated application pages with global hotkeys.
 *
 * @param props - Shell content.
 * @returns The authenticated application layout.
 */
export function AppShell(props: {
  activeWorkspace: Workspace | null;
  children: React.ReactNode;
  contentWidth: ContentWidthPercentage;
  currentUserId: string;
  projects: Project[];
  workspaces: Workspace[];
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [navigationDocuments, setNavigationDocuments] = useState<DocumentNavigationItem[]>([]);
  const shellStyle: AppShellStyle = {
    '--app-sidebar-width': `${sidebarWidth}px`,
  };

  useEffect(() => {
    const handleToggleZen = () => {
      setIsContentFullscreen((prev) => !prev);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+\ or Ctrl+\ to toggle sidebar visibility
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        setIsContentFullscreen((prev) => !prev);
        return;
      }

      // Cmd+Shift+F or Ctrl+Shift+F to toggle fullscreen
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setIsContentFullscreen((prev) => !prev);
      }
    };

    window.addEventListener(TOGGLE_FULLSCREEN_EVENT, handleToggleZen);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener(TOGGLE_FULLSCREEN_EVENT, handleToggleZen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <DocumentEditorToolbarProvider>
      <div
        ref={shellRef}
        className="relative min-h-dvh bg-transparent text-ink antialiased"
        style={shellStyle}
      >
        <AppSidebar
          activeWorkspace={props.activeWorkspace}
          currentUserId={props.currentUserId}
          isHidden={isContentFullscreen}
          projects={props.projects}
          workspaces={props.workspaces}
          width={sidebarWidth}
          onResizeCommit={(width) => {
            setSidebarWidth(clampSidebarWidth(width));
          }}
          onResizePreview={(width) => {
            shellRef.current?.style.setProperty(
              '--app-sidebar-width',
              `${clampSidebarWidth(width)}px`,
            );
          }}
          onNavigationDocumentsChange={setNavigationDocuments}
        />
        <main
          className={`min-h-dvh pt-16 transition-[margin-left] duration-200 lg:pt-0 ${
            isContentFullscreen ? 'lg:ml-0' : 'lg:ml-[var(--app-sidebar-width)]'
          }`}
        >
          <ContentToolbar
            contentWidth={props.contentWidth}
            documents={navigationDocuments}
            isContentFullscreen={isContentFullscreen}
            projects={props.projects}
            onToggleContentFullscreen={() => {
              setIsContentFullscreen((isFullscreen) => !isFullscreen);
            }}
          />
          <div className="px-5 sm:px-8 lg:px-12">{props.children}</div>
        </main>
        <CommandPalette currentUserId={props.currentUserId} />
        <ShortcutsHelpDialog />
        <KnowMeshWebMcpTools />
      </div>
    </DocumentEditorToolbarProvider>
  );
}
