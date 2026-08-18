import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserPlus,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NotificationItem, NotificationType } from '@/features/notifications/Notification';
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

function getNotificationVisuals(type: NotificationType) {
  switch (type) {
    case 'workspace_invited':
    case 'project_invited':
    case 'workspace_invitation_accepted':
    case 'project_invitation_accepted': {
      return {
        icon: UserPlus,
        iconClassName: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      };
    }
    case 'workspace_access_approved':
    case 'project_access_approved': {
      return {
        icon: ShieldCheck,
        iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    }
    case 'workspace_access_rejected':
    case 'project_access_rejected':
    case 'workspace_member_removed':
    case 'project_member_removed': {
      return {
        icon: ShieldAlert,
        iconClassName: 'bg-danger/10 text-danger-strong',
      };
    }
    case 'workspace_access_requested':
    case 'project_access_requested': {
      return {
        icon: KeyRound,
        iconClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    }
    case 'workspace_member_role_updated':
    case 'project_member_role_updated': {
      return {
        icon: UserCog,
        iconClassName: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      };
    }
    default: {
      return {
        icon: Bell,
        iconClassName: 'bg-overlay text-ink-muted',
      };
    }
  }
}

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
            <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              {unreadCount} 条未读
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">查看邀请、权限申请与项目协同动态。</p>
      </div>
      <form action={markAllNotificationsRead}>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3.5 text-sm font-medium text-ink-secondary shadow-xs transition-colors hover:bg-overlay hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={unreadCount === 0}
        >
          <CheckCheck aria-hidden="true" className="size-4" strokeWidth={1.8} />
          全部标为已读
        </button>
      </form>
    </header>
  );
}

function NotificationCard(props: { notification: NotificationItem }) {
  const visuals = getNotificationVisuals(props.notification.type);
  const IconComponent = visuals.icon;
  const markReadAction = markNotificationRead.bind(null, {
    notificationId: props.notification.id,
  });
  const isUnread = !props.notification.readAt;

  return (
    <li
      className={`group relative flex items-start gap-4 rounded-xl border p-4.5 transition-all ${
        isUnread
          ? 'border-accent/30 bg-accent-soft/30 shadow-xs hover:border-accent/50 hover:bg-accent-soft/50'
          : 'border-line/70 bg-card hover:border-line hover:bg-surface/50 hover:shadow-card'
      }`}
    >
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 ${visuals.iconClassName}`}
      >
        <IconComponent aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">{props.notification.title}</h2>
          {props.notification.targetKind && (
            <span className="inline-flex items-center rounded-md bg-overlay px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
              {props.notification.targetKind === 'project' ? '项目' : '工作区'}
            </span>
          )}
          {isUnread && <span aria-label="未读" className="size-2 rounded-full bg-accent" />}
        </div>

        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{props.notification.body}</p>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <time
            className="text-xs text-ink-faint"
            dateTime={props.notification.createdAt.toISOString()}
          >
            {dateTimeFormatter.format(props.notification.createdAt)}
          </time>

          {props.notification.targetKind === 'project' && props.notification.targetId && (
            <Link
              href={`/collaboration?project=${props.notification.targetId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
            >
              前往项目
              <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            </Link>
          )}

          {props.notification.targetKind === 'workspace' && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
            >
              前往工作区
              <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>

      {isUnread && (
        <form action={markReadAction} className="shrink-0">
          <button
            type="submit"
            aria-label={`将“${props.notification.title}”标为已读`}
            className="grid size-8 place-items-center rounded-lg border border-line/60 bg-card text-ink-muted shadow-xs transition-colors hover:border-line hover:bg-overlay hover:text-ink"
            title="标为已读"
          >
            <Check aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </button>
        </form>
      )}
    </li>
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
