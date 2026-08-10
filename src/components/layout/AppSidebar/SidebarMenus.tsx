'use client';

import { SignOutButton } from '@clerk/nextjs';
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Plus,
  Settings,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { AppLogo } from '@/components/ui/AppLogo';
import { popupMenuItemClassName, PopupMenu, PopupMenuLabel } from '@/components/ui/PopupMenu';
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
    <div className="relative flex h-12 items-center border-b border-black/6 px-1.5">
      <button
        type="button"
        aria-controls="workspace-switcher-dialog"
        aria-expanded={props.isOpen}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left transition-colors hover:bg-black/5"
        onClick={props.onToggle}
      >
        <AppLogo className="size-7 shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight">
          {props.activeWorkspace?.name ?? AppConfig.name}
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-[#8a8d91]"
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
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45"
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
              <span className="block truncate text-sm font-semibold text-[#202124]">
                {workspace.name}
              </span>
              <span className="block text-xs text-[#8a8d91]">
                {workspace.role === 'owner' ? 'Owner' : workspace.role}
              </span>
            </span>
            {workspace.id === props.activeWorkspace?.id && (
              <Check aria-hidden="true" className="size-3.5 text-[#2383e2]" strokeWidth={2} />
            )}
          </button>
        ))}
        {props.error && (
          <p className="px-2 py-1 text-xs text-[#b52e2e]" role="alert">
            {props.error}
          </p>
        )}
        <div className="my-0.5 border-t border-black/8" />
        <button type="button" className={popupMenuItemClassName} onClick={props.onCreate}>
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>新建工作区</span>
        </button>
      </PopupMenu>
    </div>
  );
}

/**
 * Renders application and account settings in a compact dialog.
 *
 * @param props - Settings state and navigation actions.
 * @returns The settings menu.
 */
export function SettingsMenu(props: {
  isOpen: boolean;
  isSettingsRoute: boolean;
  onNavigate: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative border-t border-black/6 px-1.5 py-2">
      <button
        type="button"
        aria-controls="settings-dialog"
        aria-expanded={props.isOpen}
        aria-haspopup="dialog"
        className={`flex min-h-8 w-full items-center gap-3 rounded-lg px-1.5 text-sm font-medium transition-colors ${
          props.isOpen || props.isSettingsRoute
            ? 'bg-black/7 text-[#202124]'
            : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
        }`}
        onClick={props.onToggle}
      >
        <Settings aria-hidden="true" className="size-4" strokeWidth={1.8} />
        <span>设置</span>
        <ChevronsUpDown
          aria-hidden="true"
          className="ml-auto size-4 text-[#8a8d91]"
          strokeWidth={1.8}
        />
      </button>

      <PopupMenu
        id="settings-dialog"
        isOpen={props.isOpen}
        label="设置"
        placement={{ kind: 'anchor', side: 'top' }}
      >
        <PopupMenuLabel>设置</PopupMenuLabel>
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
        <div className="my-0.5 border-t border-black/8" />
        <SignOutButton>
          <button className={popupMenuItemClassName} type="button">
            <LogOut aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            <span>退出登录</span>
          </button>
        </SignOutButton>
      </PopupMenu>
    </div>
  );
}
