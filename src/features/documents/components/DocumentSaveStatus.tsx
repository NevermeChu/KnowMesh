'use client';

import { AlertCircle, Check, Loader2, WifiOff } from 'lucide-react';

export type SaveState = 'conflict' | 'error' | 'saved' | 'saving';
export type CollaborationState = 'connecting' | 'error' | 'offline' | 'synced' | 'syncing';

/**
 * Renders a visual micro-badge indicating the current document save status.
 *
 * @param props - Current save state.
 * @returns The save status indicator badge.
 */
export function DocumentSaveStatus(props: {
  canEdit: boolean;
  collaborationState?: CollaborationState;
  state: SaveState;
}) {
  if (
    !props.canEdit &&
    props.state !== 'conflict' &&
    props.state !== 'error' &&
    (props.collaborationState === undefined || props.collaborationState === 'synced')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-muted">
        <span className="size-1.5 rounded-full bg-ink-faint" />
        只读模式
      </span>
    );
  }

  if (
    props.state === 'saving' &&
    (props.collaborationState === undefined || props.collaborationState === 'synced')
  ) {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
      >
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        保存中…
      </span>
    );
  }

  if (
    (props.state === 'conflict' || props.state === 'error') &&
    (props.collaborationState === undefined || props.collaborationState === 'synced')
  ) {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger"
      >
        <AlertCircle aria-hidden="true" className="size-3" />
        {props.state === 'conflict' ? '其他页面已更新' : '保存失败'}
      </span>
    );
  }

  if (props.collaborationState === 'connecting' || props.collaborationState === 'syncing') {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
      >
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        {props.collaborationState === 'connecting' ? '正在连接…' : '正在同步…'}
      </span>
    );
  }

  if (props.collaborationState === 'offline') {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-muted"
      >
        <WifiOff aria-hidden="true" className="size-3" />
        已离线，等待重连
      </span>
    );
  }

  if (props.collaborationState === 'error') {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger"
      >
        <AlertCircle aria-hidden="true" className="size-3" />
        同步失败，需要重试
      </span>
    );
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-xs font-medium text-emerald-600 transition-opacity duration-300 dark:text-emerald-400"
    >
      <Check aria-hidden="true" className="size-3" />
      {props.collaborationState === 'synced' ? '已同步' : '已保存'}
    </span>
  );
}
