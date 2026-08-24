import { Bell, CheckCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationCard } from '@/features/notifications/components/NotificationCard';
import {
  getNotifications,
  getUnreadNotificationCount,
} from '@/features/notifications/server/GetNotifications';
import { markAllNotificationsRead } from '@/features/notifications/server/NotificationActions';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  description: '查看邀请、权限申请与系统通知。',
  title: `通知 - ${AppConfig.name}`,
};

function NotificationsSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-start gap-4 rounded-xl border border-line bg-card p-4.5 shadow-card">
        <div className="size-10 animate-pulse rounded-xl bg-overlay" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/4 animate-pulse rounded bg-overlay" />
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-overlay" />
          <div className="h-3 w-1/6 animate-pulse rounded bg-overlay" />
        </div>
      </div>
      <div className="flex items-start gap-4 rounded-xl border border-line bg-card p-4.5 shadow-card">
        <div className="size-10 animate-pulse rounded-xl bg-overlay" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-overlay" />
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-overlay" />
          <div className="h-3 w-1/5 animate-pulse rounded bg-overlay" />
        </div>
      </div>
      <div className="flex items-start gap-4 rounded-xl border border-line bg-card p-4.5 shadow-card">
        <div className="size-10 animate-pulse rounded-xl bg-overlay" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/4 animate-pulse rounded bg-overlay" />
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-overlay" />
          <div className="h-3 w-1/6 animate-pulse rounded bg-overlay" />
        </div>
      </div>
    </div>
  );
}

async function NotificationsHeader() {
  const unreadCount = await getUnreadNotificationCount();

  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">通知</h1>
          {unreadCount > 0 && (
            <Badge size="md" variant="accent">
              {unreadCount} 条未读
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">查看邀请、权限申请与项目协同动态。</p>
      </div>
      <form action={markAllNotificationsRead}>
        <Button
          disabled={unreadCount === 0}
          icon={<CheckCheck aria-hidden="true" className="size-4" strokeWidth={1.8} />}
          type="submit"
          variant="secondary"
        >
          全部标为已读
        </Button>
      </form>
    </header>
  );
}

async function NotificationsSection() {
  const notifications = await getNotifications();

  if (notifications.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          description="新的邀请和权限动态会显示在这里。"
          icon={<Bell aria-hidden="true" className="size-5" strokeWidth={1.6} />}
          title="暂无通知"
        />
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} />
      ))}
    </ul>
  );
}

export default function NotificationsPage() {
  return (
    <WorkspaceContent className="py-10 sm:py-14">
      <Suspense fallback={null}>
        <NotificationsHeader />
      </Suspense>

      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsSection />
      </Suspense>
    </WorkspaceContent>
  );
}
