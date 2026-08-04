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
import { AppConfig } from '@/utils/AppConfig';

function SidebarDialog(props: {
  children: React.ReactNode;
  id: string;
  isOpen: boolean;
  label: string;
  placement: 'bottom' | 'top';
}) {
  if (!props.isOpen) {
    return null;
  }

  return (
    <dialog
      open
      id={props.id}
      aria-label={props.label}
      className={`absolute left-1.5 z-20 m-0 w-[13.333rem] max-w-[calc(100vw-0.75rem)] rounded-lg border border-black/10 bg-white p-1 text-[#2f3437] shadow-lg ${
        props.placement === 'bottom' ? 'top-11' : 'bottom-10'
      }`}
    >
      {props.children}
    </dialog>
  );
}

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
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-md bg-[#2f3437] text-xs font-bold text-white"
        >
          K
        </span>
        <span className="truncate text-sm font-semibold tracking-tight">{AppConfig.name}</span>
        <ChevronsUpDown
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-[#8a8d91]"
          strokeWidth={1.8}
        />
      </button>

      <SidebarDialog
        id="workspace-switcher-dialog"
        isOpen={props.isOpen}
        label="切换工作区"
        placement="bottom"
      >
        <p className="px-1.5 pt-1 pb-0.5 text-xs font-semibold tracking-[0.08em] text-[#8a8d91] uppercase">
          切换工作区
        </p>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-black/5"
          onClick={props.onClose}
        >
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-[#2f3437] text-xs font-bold text-white"
          >
            K
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#202124]">
              {AppConfig.name}
            </span>
            <span className="block text-xs text-[#8a8d91]">当前工作区</span>
          </span>
          <Check aria-hidden="true" className="size-3.5 text-[#2383e2]" strokeWidth={2} />
        </button>
      </SidebarDialog>
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

      <SidebarDialog id="settings-dialog" isOpen={props.isOpen} label="设置" placement="top">
        <p className="px-1.5 pt-1 pb-0.5 text-xs font-semibold tracking-[0.08em] text-[#8a8d91] uppercase">
          设置
        </p>
        <Link
          href="/settings/preferences"
          className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-[#555a60] transition-colors hover:bg-black/5 hover:text-[#202124]"
          onClick={props.onNavigate}
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>系统偏好设置</span>
        </Link>
        <Link
          href="/settings/user-profile"
          className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-[#555a60] transition-colors hover:bg-black/5 hover:text-[#202124]"
          onClick={props.onNavigate}
        >
          <UserRound aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          <span>账号设置</span>
        </Link>
        <div className="my-0.5 border-t border-black/8" />
        <SignOutButton>
          <button
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-[#555a60] transition-colors hover:bg-black/5 hover:text-[#202124]"
            type="button"
          >
            <LogOut aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            <span>退出登录</span>
          </button>
        </SignOutButton>
      </SidebarDialog>
    </div>
  );
}
