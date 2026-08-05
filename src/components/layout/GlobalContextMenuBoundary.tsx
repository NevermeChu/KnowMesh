'use client';

import { useEffect } from 'react';

/**
 * Prevents the browser context menu across the application.
 *
 * @param props - Application content.
 * @returns The global context-menu event boundary.
 */
export function GlobalContextMenuBoundary(props: { children: React.ReactNode }) {
  useEffect(() => {
    const preventBrowserContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener('contextmenu', preventBrowserContextMenu);

    return () => {
      document.removeEventListener('contextmenu', preventBrowserContextMenu);
    };
  }, []);

  return <>{props.children}</>;
}
