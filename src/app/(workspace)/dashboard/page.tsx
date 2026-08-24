import { ArrowRight, ChevronRight, FileText, Search, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { EmptyState } from '@/components/ui/EmptyState';
import { getRecentDocuments } from '@/features/documents/server/GetRecentDocuments';
import {
  getNotifications,
  getUnreadNotificationCount,
} from '@/features/notifications/server/GetNotifications';
import { getPendingApprovals } from '@/features/permissions/server/GetPendingApprovals';
import { DashboardPendingItems } from '@/features/workspaces/components/DashboardPendingItems';
import { getPendingInvitations } from '@/features/workspaces/server/GetPendingInvitations';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
});

const quickActions = [
  {
    description: '整理个人笔记与私有资料',
    href: '/personal',
    icon: FileText,
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    title: '个人知识库',
  },
  {
    description: '查看团队项目与协同文档',
    href: '/collaboration',
    icon: Users,
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    title: '团队协作区',
  },
  {
    description: '快速查找文档正文与项目',
    href: '/search',
    icon: Search,
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    title: '全站搜索',
  },
  {
    description: '访问星标的重要参考资料',
    href: '/starred',
    icon: Star,
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    title: '常用收藏',
  },
];

function QuickActionsBar() {
  return (
    <section aria-labelledby="quick-actions-heading" className="mt-6">
      <h2 id="quick-actions-heading" className="sr-only">
        快捷入口
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group relative flex items-start gap-3.5 rounded-xl border border-line bg-card p-3.5 shadow-card transition-all hover:border-accent/40 hover:bg-overlay active:scale-[0.985]"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${action.iconBg}`}
              >
                <Icon aria-hidden="true" className="size-4.5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold text-ink transition-colors group-hover:text-accent">
                  {action.title}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RecentDocumentsSkeleton() {
  return (
    <section aria-labelledby="recent-documents-heading" className="lg:col-span-2">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-documents-heading" className="text-sm font-semibold text-ink">
          最近文档
        </h2>
      </div>
      <div className="mt-3 h-64 animate-pulse rounded-xl border border-line bg-card p-4 shadow-card" />
    </section>
  );
}

async function RecentDocumentsSection() {
  const recentDocuments = await getRecentDocuments();

  return (
    <section aria-labelledby="recent-documents-heading" className="lg:col-span-2">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-documents-heading" className="text-sm font-semibold text-ink">
          最近文档
        </h2>
        {recentDocuments.length > 0 && (
          <span className="text-xs text-ink-faint">共 {recentDocuments.length} 篇</span>
        )}
      </div>
      {recentDocuments.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            description="在左侧创建项目并撰写文档后，即可在这里快速访问最近内容。"
            icon={<FileText aria-hidden="true" className="size-5" strokeWidth={1.6} />}
            title="还没有可打开的文档"
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft rounded-xl border border-line bg-card shadow-card">
          {recentDocuments.map((document) => (
            <li key={document.documentId}>
              <Link
                href={`/${document.workspaceKind === 'personal' ? 'personal' : 'collaboration'}?project=${document.projectId}&document=${document.documentId}`}
                className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-overlay"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent transition-transform group-hover:scale-105">
                  <FileText aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-accent">
                    {document.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                    <span className="py-0.2 rounded bg-surface px-1.5 text-[11px] font-medium text-ink-secondary">
                      {document.projectName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{document.workspaceKind === 'personal' ? '个人空间' : '团队协作'}</span>
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
  );
}

function NotificationsSkeleton() {
  return (
    <section aria-labelledby="notifications-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="notifications-heading" className="text-sm font-semibold text-ink">
          通知
        </h2>
      </div>
      <div className="mt-3 h-28 animate-pulse rounded-xl border border-line bg-card p-4 shadow-card" />
    </section>
  );
}

async function NotificationsSection() {
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(),
    getUnreadNotificationCount(),
  ]);
  const latestNotifications = notifications.slice(0, 3);

  return (
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
      <div className="mt-3 rounded-xl border border-line bg-card p-4 shadow-card">
        {unreadCount > 0 && (
          <p className="mb-2 text-sm text-ink">
            <span className="font-semibold text-accent">{unreadCount}</span> 条未读通知
          </p>
        )}
        {latestNotifications.length === 0 ? (
          <p className="text-xs leading-relaxed text-ink-muted">
            {unreadCount === 0 ? '暂无新通知，团队邀请与权限动态会显示在此处。' : null}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {latestNotifications.map((notification) => (
              <li key={notification.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    notification.readAt ? 'bg-transparent' : 'bg-accent'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">
                    {notification.title}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PendingItemsSkeleton() {
  return (
    <section aria-labelledby="pending-items-heading">
      <h2 id="pending-items-heading" className="text-sm font-semibold text-ink">
        待处理事项
      </h2>
      <div className="mt-3 h-28 animate-pulse rounded-xl border border-line bg-card p-4 shadow-card" />
    </section>
  );
}

async function PendingItemsSection() {
  const [pendingApprovals, pendingInvitations] = await Promise.all([
    getPendingApprovals(),
    getPendingInvitations(),
  ]);

  return (
    <section aria-labelledby="pending-items-heading">
      <h2 id="pending-items-heading" className="text-sm font-semibold text-ink">
        待处理事项
      </h2>
      <div className="mt-3 rounded-xl border border-line bg-card p-4 shadow-card">
        <DashboardPendingItems
          pendingApprovals={pendingApprovals}
          pendingInvitations={pendingInvitations}
        />
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <WorkspaceContent className="py-8 sm:py-12">
      <header className="border-b border-line-soft pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">欢迎回来</h1>
        <p className="mt-1 text-sm text-ink-muted">从这里继续最近的工作，并处理通知与协作请求。</p>
      </header>

      <QuickActionsBar />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<RecentDocumentsSkeleton />}>
          <RecentDocumentsSection />
        </Suspense>

        <div className="space-y-6">
          <Suspense fallback={<NotificationsSkeleton />}>
            <NotificationsSection />
          </Suspense>

          <Suspense fallback={<PendingItemsSkeleton />}>
            <PendingItemsSection />
          </Suspense>
        </div>
      </div>
    </WorkspaceContent>
  );
}
