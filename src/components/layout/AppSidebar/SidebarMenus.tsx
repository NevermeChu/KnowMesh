'use client';

import {
  Bell,
  Check,
  ChevronsUpDown,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { AppLogo } from '@/components/ui/AppLogo';
import { popupMenuItemClassName, PopupMenu, PopupMenuLabel } from '@/components/ui/PopupMenu';
import { SignOutButton } from '@/features/auth/components/SignOutButton';
import { ThemeToggle } from '@/features/preferences/components/ThemeToggle';
import type { Workspace } from '@/features/workspaces/Workspace';
import { AppConfig } from '@/utils/AppConfig';

/**
 * Displays the workspace switcher and its compact dialog.
 *
 * @param props - Switcher state and actions.
 * @returns The workspace switcher.
 */
export function WorkspaceSwitcher(props: {
  activeWorkspace: Workspace | null;
  error: string | null;
  isOpen: boolean;
  isPending: boolean;
  workspaces: Workspace[];
  onClose: () => void;
  onCreate: () => void;
  onSelect: (workspaceId: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative flex h-12 items-center border-b border-line-soft px-1.5">
      <button
        type="button"
        aria-controls="workspace-switcher-dialog"
        aria-expanded={props.isOpen}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left transition-colors hover:bg-overlay"
        onClick={props.onToggle}
      >
        <AppLogo className="size-7 shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight">
          {props.activeWorkspace?.name ?? AppConfig.name}
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-ink-faint"
          strokeWidth={1.8}
        />
      </button>

      <PopupMenu
        id="workspace-switcher-dialog"
        isOpen={props.isOpen}
        label="切换工作区"
        placement={{ kind: 'anchor', side: 'bottom' }}
      >
        <PopupMenuLabel>切换工作区</PopupMenuLabel>
        {props.workspaces.map((workspace) => (
          <button
            type="button"
            key={workspace.id}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-overlay disabled:cursor-not-allowed disabled:opacity-45"
            disabled={props.isPending}
            onClick={() => {
              if (workspace.id === props.activeWorkspace?.id) {
                props.onClose();
                return;
              }
              props.onSelect(workspace.id);
            }}
          >
            <AppLogo className="size-7 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {workspace.name}
              </span>
              <span className="block text-xs text-ink-faint">
                {workspace.role === 'owner' ? 'Owner' : workspace.role}
              </span>
            </span>
            {workspace.id === props.activeWorkspace?.id && (
              <Check aria-hidden="true" className="size-3.5 text-accent" strokeWidth={2} />
            )}
          </button>
        ))}
        {props.error && (
          <p className="px-2 py-1 text-xs text-danger-strong" role="alert">
            {props.error}
          </p>
        )}
        <div className="my-0.5 border-t border-line" />
        <button type="button" className={popupMenuItemClassName} onClick={props.onCreate}>
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>新建工作区</span>
        </button>
      </PopupMenu>
    </div>
  );
}

/**
 * Renders notification and settings shortcuts in the sidebar footer.
 *
 * @param props - Settings state and navigation actions.
 * @returns The settings menu.
 */
export function SettingsMenu(props: {
  isOpen: boolean;
  isNotificationsRoute: boolean;
  isSettingsRoute: boolean;
  isWorkspaceAvailable: boolean;
  unreadNotificationCount: number;
  onManageWorkspace: () => void;
  onNavigate: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative flex flex-col gap-1 border-t border-line-soft px-1.5 py-2">
      <Link
        href="/notifications"
        aria-current={props.isNotificationsRoute ? 'page' : undefined}
        className={`flex min-h-8 w-full items-center gap-3 rounded-lg px-1.5 text-sm font-medium transition-colors ${
          props.isNotificationsRoute
            ? 'bg-accent-soft text-accent'
            : 'text-ink-muted hover:bg-overlay hover:text-ink'
        }`}
        onClick={props.onNavigate}
      >
        <Bell aria-hidden="true" className="size-4" strokeWidth={1.8} />
        <span>通知</span>
        {props.unreadNotificationCount > 0 && (
          <span
            className="ml-auto min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[10px] leading-4 font-semibold text-white"
            aria-label={`${props.unreadNotificationCount} 条未读通知`}
          >
            {props.unreadNotificationCount > 99 ? '99+' : props.unreadNotificationCount}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-controls="settings-dialog"
          aria-expanded={props.isOpen}
          aria-haspopup="dialog"
          className={`flex min-h-8 min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 text-sm font-medium transition-colors ${
            props.isOpen || props.isSettingsRoute
              ? 'bg-overlay-strong text-ink'
              : 'text-ink-muted hover:bg-overlay hover:text-ink'
          }`}
          onClick={props.onToggle}
        >
          <Settings aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
          <span>设置</span>
          <ChevronsUpDown
            aria-hidden="true"
            className="ml-auto size-4 text-ink-faint"
            strokeWidth={1.8}
          />
        </button>
        <ThemeToggle />
      </div>

      <PopupMenu
        id="settings-dialog"
        isOpen={props.isOpen}
        label="设置"
        placement={{ kind: 'anchor', side: 'top' }}
        surfaceClassName="right-1.5 w-[calc(var(--app-sidebar-width)-1.5rem)]"
      >
        <PopupMenuLabel>设置</PopupMenuLabel>
        <button
          type="button"
          className={popupMenuItemClassName}
          disabled={!props.isWorkspaceAvailable}
          onClick={props.onManageWorkspace}
        >
          <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>工作区管理</span>
        </button>
        <Link
          href="/settings/preferences"
          className={popupMenuItemClassName}
          onClick={props.onNavigate}
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>系统偏好设置</span>
        </Link>
        <Link
          href="/settings/user-profile"
          className={popupMenuItemClassName}
          onClick={props.onNavigate}
        >
          <UserRound aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>账号设置</span>
        </Link>
        <div className="my-0.5 border-t border-line" />
        <SignOutButton className={popupMenuItemClassName}>
          <LogOut aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>退出登录</span>
        </SignOutButton>
      </PopupMenu>
    </div>
  );
}
