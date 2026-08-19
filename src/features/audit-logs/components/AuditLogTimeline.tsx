'use client';

import {
  FileCode,
  Globe,
  History,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import type { AuditAction, AuditLogCategory, AuditLogItem, AuditLogMetadata } from '../AuditLog';
import { auditActionCategories, auditActionLabels } from '../AuditLog';

const categoryTabs: { key: AuditLogCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'permissions', label: '权限与所有权' },
  { key: 'membership', label: '成员变动' },
  { key: 'resources', label: '资源变更' },
];

function getActionBadgeStyle(action: AuditAction): {
  bg: string;
  border: string;
  icon: typeof ShieldCheck;
  text: string;
} {
  if (action === 'workspace_ownership_transferred' || action === 'project_ownership_transferred') {
    return {
      bg: 'bg-purple-500/10 dark:bg-purple-400/15',
      border: 'border-purple-500/20 dark:border-purple-400/30',
      icon: KeyRound,
      text: 'text-purple-700 dark:text-purple-300',
    };
  }

  if (
    action === 'project_deleted' ||
    action === 'workspace_member_removed' ||
    action === 'project_member_removed' ||
    action === 'workspace_access_rejected' ||
    action === 'project_access_rejected'
  ) {
    return {
      bg: 'bg-danger-soft',
      border: 'border-danger-strong/20',
      icon: Trash2,
      text: 'text-danger-strong',
    };
  }

  if (
    action === 'workspace_access_approved' ||
    action === 'project_access_approved' ||
    action === 'workspace_invitation_accepted' ||
    action === 'project_invitation_accepted'
  ) {
    return {
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
      border: 'border-emerald-500/20 dark:border-emerald-400/30',
      icon: UserCheck,
      text: 'text-emerald-700 dark:text-emerald-300',
    };
  }

  if (action === 'workspace_invited' || action === 'project_invited') {
    return {
      bg: 'bg-sky-500/10 dark:bg-sky-400/15',
      border: 'border-sky-500/20 dark:border-sky-400/30',
      icon: UserPlus,
      text: 'text-sky-700 dark:text-sky-300',
    };
  }

  if (action === 'project_created') {
    return {
      bg: 'bg-accent-soft',
      border: 'border-accent/20',
      icon: FileCode,
      text: 'text-accent',
    };
  }

  return {
    bg: 'bg-overlay',
    border: 'border-line',
    icon: ShieldCheck,
    text: 'text-ink-muted',
  };
}

const actionDescriptions: Record<AuditAction, (metadata: AuditLogMetadata) => React.ReactNode> = {
  project_access_approved: (meta) => (
    <span>
      批准{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      在项目 “{meta.resourceName ?? ''}” 中的权限申请
    </span>
  ),
  project_access_rejected: (meta) => (
    <span>
      驳回{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      在项目 “{meta.resourceName ?? ''}” 中的权限申请
    </span>
  ),
  project_created: (meta) => (
    <span>
      创建项目 <span className="font-semibold text-ink">“{meta.resourceName ?? ''}”</span>
    </span>
  ),
  project_deleted: (meta) => (
    <span>
      删除项目 <span className="font-semibold text-ink">“{meta.resourceName ?? ''}”</span>
    </span>
  ),
  project_invitation_accepted: (meta) => <span>接受加入项目 “{meta.resourceName ?? ''}” 邀请</span>,
  project_invitation_revoked: (meta) => (
    <span>
      撤回向{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      发出的项目 “{meta.resourceName ?? ''}” 邀请
    </span>
  ),
  project_invited: (meta) => (
    <span>
      邀请{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      加入项目 “{meta.resourceName ?? ''}”
    </span>
  ),
  project_member_removed: (meta) => (
    <span>
      将成员{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      移出项目 “{meta.resourceName ?? ''}”
    </span>
  ),
  project_member_role_updated: (meta) => (
    <span>
      将成员{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      在项目 “{meta.resourceName ?? ''}” 中的角色修改为{' '}
      <span className="font-semibold text-ink">
        {meta.nextRole === 'editor' ? '编辑者' : '查看者'}
      </span>
    </span>
  ),
  project_ownership_transferred: (meta) => (
    <span>
      将项目 “{meta.resourceName ?? ''}” 的所有权转让给{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>
    </span>
  ),
  project_renamed: (meta) => (
    <span>
      将项目重命名为 <span className="font-semibold text-ink">“{meta.resourceName ?? ''}”</span>
    </span>
  ),
  workspace_access_approved: (meta) => (
    <span>
      批准{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      的工作区编辑权限申请
    </span>
  ),
  workspace_access_rejected: (meta) => (
    <span>
      驳回{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      的工作区编辑权限申请
    </span>
  ),
  workspace_invitation_accepted: () => <span>接受加入工作区邀请</span>,
  workspace_invitation_revoked: (meta) => (
    <span>
      撤回向 <span className="font-semibold text-ink">{meta.targetUserEmail ?? '成员'}</span>{' '}
      发出的工作区邀请
    </span>
  ),
  workspace_invited: (meta) => (
    <span>
      发出工作区邀请至{' '}
      <span className="font-semibold text-ink">{meta.targetUserEmail ?? '成员'}</span>
    </span>
  ),
  workspace_member_removed: (meta) => (
    <span>
      将成员{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      移出工作区
    </span>
  ),
  workspace_member_role_updated: (meta) => (
    <span>
      将成员{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>{' '}
      的工作区角色修改为{' '}
      <span className="font-semibold text-ink">
        {meta.nextRole === 'editor' ? '编辑者' : '查看者'}
      </span>
    </span>
  ),
  workspace_ownership_transferred: (meta) => (
    <span>
      将工作区所有权转让给{' '}
      <span className="font-semibold text-ink">
        {meta.targetUserName ?? meta.targetUserEmail ?? '成员'}
      </span>
    </span>
  ),
  workspace_renamed: (meta) => (
    <span>
      将工作区重命名为 <span className="font-semibold text-ink">“{meta.resourceName ?? ''}”</span>
    </span>
  ),
};

function formatDate(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

/**
 * Displays an interactive, filterable timeline of workspace audit logs.
 *
 * @param props - List of audit log items.
 * @returns Filterable audit log stream.
 */
export function AuditLogTimeline(props: { items: AuditLogItem[] }) {
  const [selectedCategory, setSelectedCategory] = useState<AuditLogCategory>('all');

  const filteredItems = props.items.filter((item) => {
    if (selectedCategory === 'all') {
      return true;
    }
    return auditActionCategories[item.action] === selectedCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-line-soft pb-4">
        {categoryTabs.map((tab) => {
          const isActive = selectedCategory === tab.key;
          return (
            <button
              type="button"
              key={tab.key}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-muted hover:bg-overlay hover:text-ink'
              }`}
              onClick={() => {
                setSelectedCategory(tab.key);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-16 text-center">
          <History className="size-8 text-ink-faint" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-ink-muted">暂无符合条件的审计日志记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const badge = getActionBadgeStyle(item.action);
            const BadgeIcon = badge.icon;
            const descriptionRenderer = actionDescriptions[item.action];

            return (
              <div
                key={item.id}
                className="bg-surface-raised flex flex-col gap-3 rounded-xl border border-line-soft p-4 transition-colors hover:border-line sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border ${badge.border} ${badge.bg}`}
                  >
                    <BadgeIcon className={`size-4 ${badge.text}`} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {item.actor.displayName}
                      </span>
                      {item.actor.email && (
                        <span className="text-xs text-ink-faint">({item.actor.email})</span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${badge.border} ${badge.bg} ${badge.text}`}
                      >
                        {auditActionLabels[item.action] ?? item.action}
                      </span>
                    </div>
                    <div className="text-sm text-ink-muted">
                      {descriptionRenderer ? (
                        descriptionRenderer(item.metadata)
                      ) : (
                        <span>执行操作 {auditActionLabels[item.action] ?? item.action}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-xs text-ink-faint sm:flex-col sm:items-end sm:gap-1">
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {formatDate(item.createdAt)}
                  </time>
                  {item.ipAddress && (
                    <span className="flex items-center gap-1">
                      <Globe className="size-3 text-ink-faint" />
                      <span>{item.ipAddress}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
