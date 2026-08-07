'use client';

import { SignOutButton } from '@clerk/nextjs';
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Settings,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { AppLogo } from '@/components/ui/AppLogo';
import { popupMenuItemClassName, PopupMenu, PopupMenuLabel } from '@/components/ui/PopupMenu';
import { AppConfig } from '@/utils/AppConfig';

/**
 * Displays the workspace switcher and its compact dialog.
 *
 * @param props - Switcher state and actions.
 * @returns The workspace switcher.
 */
export function WorkspaceSwitcher(props: {
  isOpen: boolean;
  onClose: () => void;
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
        <span className="truncate text-sm font-semibold tracking-tight">{AppConfig.name}</span>
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
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-black/5"
          onClick={props.onClose}
        >
          <AppLogo className="size-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#202124]">
              {AppConfig.name}
            </span>
            <span className="block text-xs text-[#8a8d91]">当前工作区</span>
          </span>
          <Check aria-hidden="true" className="size-3.5 text-[#2383e2]" strokeWidth={2} />
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
