import { Bell, Check, CheckCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getNotifications,
  getUnreadNotificationCount,
} from '@/features/notifications/server/GetNotifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/server/NotificationActions';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  description: '查看邀请、权限申请与系统通知。',
  title: `通知 - ${AppConfig.name}`,
};

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function NotificationsSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <div className="h-24 animate-pulse rounded-xl border border-line bg-card p-4 shadow-card" />
      <div className="h-24 animate-pulse rounded-xl border border-line bg-card p-4 shadow-card" />
      <div className="h-24 animate-pulse rounded-xl border border-line bg-card p-4 shadow-card" />
    </div>
  );
}

async function MarkAllReadButton() {
  const unreadCount = await getUnreadNotificationCount();

  return (
    <form action={markAllNotificationsRead}>
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-overlay disabled:cursor-not-allowed disabled:opacity-45"
        disabled={unreadCount === 0}
      >
        <CheckCheck aria-hidden="true" className="size-4" strokeWidth={1.8} />
        全部标为已读
      </button>
    </form>
  );
}

async function NotificationsSection() {
  const notifications = await getNotifications();

  if (notifications.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          description="新的邀请和权限动态会显示在这里。"
          icon={<Bell aria-hidden="true" className="size-5" strokeWidth={1.6} />}
          title="暂无通知"
        />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {notifications.map((notification) => {
        const markReadAction = markNotificationRead.bind(null, {
          notificationId: notification.id,
        });

        return (
          <li
            key={notification.id}
            className={`flex gap-3 py-5 ${notification.readAt ? '' : 'bg-accent-soft'}`}
          >
            <span
              aria-hidden="true"
              className={`mt-2 size-2 shrink-0 rounded-full ${
                notification.readAt ? 'bg-transparent' : 'bg-accent'
              }`}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">{notification.title}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{notification.body}</p>
              <time
                className="mt-2 block text-xs text-ink-faint"
                dateTime={notification.createdAt.toISOString()}
              >
                {dateTimeFormatter.format(notification.createdAt)}
              </time>
            </div>
            {!notification.readAt && (
              <form action={markReadAction}>
                <button
                  type="submit"
                  aria-label={`将“${notification.title}”标为已读`}
                  className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink"
                  title="标为已读"
                >
                  <Check aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function NotificationsPage() {
  return (
    <WorkspaceContent className="py-10 sm:py-14">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">通知</h1>
          <p className="mt-1 text-sm text-ink-muted">查看邀请、权限申请与审批结果。</p>
        </div>
        <Suspense fallback={null}>
          <MarkAllReadButton />
        </Suspense>
      </header>

      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsSection />
      </Suspense>
    </WorkspaceContent>
  );
}
