'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SettingsMenu, WorkspaceSwitcher } from '@/components/layout/AppSidebar/SidebarMenus';
import { SidebarPrimaryNavigation } from '@/components/layout/AppSidebar/SidebarPrimaryNavigation';
import { SidebarWorkspaceNavigation } from '@/components/layout/AppSidebar/SidebarWorkspaceNavigation';
import { AppConfig } from '@/utils/AppConfig';

type SidebarMenu = 'settings' | 'workspace' | null;

const menuDialogIds: Record<Exclude<SidebarMenu, null>, string> = {
  settings: 'settings-dialog',
  workspace: 'workspace-switcher-dialog',
};

function SidebarContent(props: {
  openMenu: SidebarMenu;
  pathname: string;
  onCloseMenu: () => void;
  onNavigate: () => void;
  onToggleMenu: (menu: Exclude<SidebarMenu, null>) => void;
}) {
  return (
    <>
      <WorkspaceSwitcher
        isOpen={props.openMenu === 'workspace'}
        onClose={props.onCloseMenu}
        onToggle={() => {
          props.onToggleMenu('workspace');
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 py-4">
        <SidebarPrimaryNavigation pathname={props.pathname} onNavigate={props.onNavigate} />
        <SidebarWorkspaceNavigation pathname={props.pathname} onNavigate={props.onNavigate} />
      </div>

      <SettingsMenu
        isOpen={props.openMenu === 'settings'}
        isSettingsRoute={props.pathname.startsWith('/settings')}
        onNavigate={props.onNavigate}
        onToggle={() => {
          props.onToggleMenu('settings');
        }}
      />
    </>
  );
}

/**
 * Renders the authenticated application navigation.
 *
 * @param props - Sidebar visibility, sizing, and resize behavior.
 * @returns The responsive application sidebar.
 */
export function AppSidebar(props: {
  isHidden: boolean;
  width: number;
  onResize: (width: number) => void;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<SidebarMenu>(null);

  const closeNavigation = () => {
    setIsOpen(false);
    setOpenMenu(null);
  };

  const closeMenuFromSidebarClick = (event: React.PointerEvent<HTMLElement>) => {
    if (!openMenu || !(event.target instanceof Element)) {
      return;
    }

    const dialogId = menuDialogIds[openMenu];
    const isInsideDialog = event.target.closest(`#${dialogId}`);
    const isTrigger = event.target.closest(`[aria-controls="${dialogId}"]`);

    if (!isInsideDialog && !isTrigger) {
      setOpenMenu(null);
    }
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-black/8 bg-[#f3f5f7] px-4 lg:hidden">
        <button
          type="button"
          aria-controls="app-sidebar"
          aria-expanded={isOpen}
          aria-label="打开导航"
          className="grid size-9 place-items-center rounded-lg text-[#666a70] transition-colors hover:bg-black/5 hover:text-[#202124]"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <span className="ml-3 text-sm font-semibold">{AppConfig.name}</span>
      </header>

      {(isOpen || openMenu) && (
        <button
          type="button"
          aria-label={openMenu ? '关闭弹窗' : '关闭导航'}
          className={`fixed inset-0 z-40 ${isOpen ? 'bg-black/25 lg:bg-transparent' : 'bg-transparent'}`}
          onClick={closeNavigation}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-visible border-r border-black/6 bg-[#f3f5f7] transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${props.isHidden ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
        style={{ width: props.width }}
        onPointerDownCapture={closeMenuFromSidebarClick}
      >
        <button
          type="button"
          aria-label="关闭导航"
          className="absolute top-3 right-3 z-30 grid size-9 place-items-center rounded-lg text-[#666a70] transition-colors hover:bg-black/5 lg:hidden"
          onClick={closeNavigation}
        >
          <X aria-hidden="true" className="size-5" />
        </button>

        <div className="flex h-full w-full flex-col">
          <SidebarContent
            openMenu={openMenu}
            pathname={pathname}
            onCloseMenu={() => {
              setOpenMenu(null);
            }}
            onNavigate={closeNavigation}
            onToggleMenu={(menu) => {
              setOpenMenu((currentMenu) => (currentMenu === menu ? null : menu));
            }}
          />
        </div>

        <button
          type="button"
          aria-label="调整导航栏宽度"
          className="absolute inset-y-0 right-0 hidden w-1 cursor-col-resize touch-none transition-colors hover:bg-[#2383e2]/35 focus:bg-[#2383e2]/35 focus:outline-none lg:block"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              props.onResize(props.width - 8);
            }
            if (event.key === 'ArrowRight') {
              props.onResize(props.width + 8);
            }
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              props.onResize(event.clientX);
            }
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        />
      </aside>
    </>
  );
}
