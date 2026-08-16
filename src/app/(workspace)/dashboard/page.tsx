import { ChevronRight, FileText, Inbox, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getRecentDocuments } from '@/features/documents/server/GetRecentDocuments';
import {
  getNotifications,
  getUnreadNotificationCount,
} from '@/features/notifications/server/GetNotifications';
import { getPendingApprovals } from '@/features/permissions/server/GetPendingApprovals';
import { getPendingInvitations } from '@/features/workspaces/server/GetPendingInvitations';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
});

const requestedRoleLabels: Record<string, string> = {
  editor: '可编辑',
  viewer: '只读',
};

export default async function DashboardPage() {
  const [recentDocuments, notifications, unreadCount, pendingApprovals, pendingInvitations] =
    await Promise.all([
      getRecentDocuments(),
      getNotifications(),
      getUnreadNotificationCount(),
      getPendingApprovals(),
      getPendingInvitations(),
    ]);
  const latestNotifications = notifications.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl py-10 sm:py-14">
      <header className="border-b border-line-soft pb-5">
        <p className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">工作台</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">欢迎回来</h1>
        <p className="mt-1 text-sm text-ink-muted">从这里继续最近的工作，并处理通知与协作请求。</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="recent-documents-heading" className="lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-documents-heading" className="text-sm font-semibold text-ink">
              最近文档
            </h2>
          </div>
          {recentDocuments.length === 0 ? (
            <div className="mt-3 grid min-h-48 place-items-center rounded-lg border border-line bg-card text-center">
              <div>
                <FileText
                  aria-hidden="true"
                  className="mx-auto size-7 text-ink-faint"
                  strokeWidth={1.5}
                />
                <p className="mt-2 text-sm font-medium text-ink-secondary">还没有可打开的文档</p>
                <p className="mt-1 text-xs text-ink-faint">
                  在左侧创建项目后，即可在这里看到最近的文档。
                </p>
              </div>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft rounded-lg border border-line bg-card">
              {recentDocuments.map((document) => (
                <li key={document.documentId}>
                  <Link
                    href={`/${document.workspaceKind === 'personal' ? 'personal' : 'collaboration'}?project=${document.projectId}&document=${document.documentId}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-overlay"
                  >
                    <FileText
                      aria-hidden="true"
                      className="size-4 shrink-0 text-ink-faint"
                      strokeWidth={1.8}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {document.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-faint">
                        {document.projectName}
                      </span>
                    </span>
                    <time
                      className="shrink-0 text-xs text-ink-faint"
                      dateTime={document.updatedAt.toISOString()}
                    >
                      {dateTimeFormatter.format(document.updatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="notifications-heading">
            <div className="flex items-center justify-between gap-4">
              <h2 id="notifications-heading" className="text-sm font-semibold text-ink">
                通知
              </h2>
              <Link
                href="/notifications"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
              >
                查看全部
                <ChevronRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              </Link>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-card p-4">
              {unreadCount > 0 && (
                <p className="text-sm text-ink">
                  <span className="font-semibold text-accent">{unreadCount}</span> 条未读通知
                </p>
              )}
              {latestNotifications.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {unreadCount === 0 ? '暂无通知，邀请和权限动态会显示在这里。' : null}
                </p>
              ) : (
                <ul className={unreadCount > 0 ? 'mt-3 space-y-2.5' : 'space-y-2.5'}>
                  {latestNotifications.map((notification) => (
                    <li key={notification.id} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                          notification.readAt ? 'bg-transparent' : 'bg-accent'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {notification.title}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="pending-items-heading">
            <h2 id="pending-items-heading" className="text-sm font-semibold text-ink">
              待处理
            </h2>
            <div className="mt-3 rounded-lg border border-line bg-card p-4">
              {pendingInvitations.length === 0 && pendingApprovals.length === 0 ? (
                <p className="text-sm text-ink-muted">暂无待处理的邀请与协作请求。</p>
              ) : (
                <ul className="space-y-3">
                  {pendingInvitations.map((invitation) => (
                    <li key={invitation.workspaceName} className="flex items-start gap-2.5">
                      <Inbox
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-accent"
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink">
                          「{invitation.workspaceName}」邀请你加入
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          请查收邮件中的邀请链接完成加入。
                        </span>
                      </span>
                    </li>
                  ))}
                  {pendingApprovals.map((approval) => (
                    <li
                      key={`${approval.kind}-${approval.resourceName}-${approval.createdAt.toISOString()}`}
                      className="flex items-start gap-2.5"
                    >
                      <ShieldCheck
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-accent"
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink">
                          有人申请加入「{approval.resourceName}」
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          申请{approval.kind === 'workspace' ? '工作区' : '项目'}
                          {requestedRoleLabels[approval.requestedRole] ?? approval.requestedRole}
                          权限，可在
                          {approval.kind === 'workspace' ? '工作区管理' : '项目权限弹窗'}中处理。
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
