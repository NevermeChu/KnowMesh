'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar/AppSidebar';
import { ContentToolbar } from '@/components/layout/ContentToolbar';

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
export function AppShell(props: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const shellStyle: AppShellStyle = {
    '--app-sidebar-width': `${sidebarWidth}px`,
  };

  return (
    <div className="min-h-dvh bg-[#fbfbfa] text-[#2f3437] antialiased" style={shellStyle}>
      <AppSidebar
        isHidden={isContentFullscreen}
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
  );
}
