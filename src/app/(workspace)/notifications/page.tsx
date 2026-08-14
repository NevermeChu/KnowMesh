import { Bell, Check, CheckCheck } from 'lucide-react';
import {
  getNotifications,
  getUnreadNotificationCount,
} from '@/features/notifications/server/GetNotifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/server/NotificationActions';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function NotificationsPage() {
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(),
    getUnreadNotificationCount(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl py-10 sm:py-14">
      <header className="flex items-start justify-between gap-4 border-b border-black/8 pb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#8a8d91] uppercase">
            消息中心
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#202124]">通知</h1>
          <p className="mt-1 text-sm text-[#777b80]">查看邀请、权限申请与审批结果。</p>
        </div>
        <form action={markAllNotificationsRead}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium text-[#55595e] transition-colors hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={unreadCount === 0}
          >
            <CheckCheck aria-hidden="true" className="size-4" strokeWidth={1.8} />
            全部标为已读
          </button>
        </form>
      </header>

      {notifications.length === 0 ? (
        <div className="grid min-h-72 place-items-center text-center">
          <div>
            <Bell aria-hidden="true" className="mx-auto size-8 text-[#a1a4a8]" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-[#55595e]">暂无通知</p>
            <p className="mt-1 text-xs text-[#8a8d91]">新的邀请和权限动态会显示在这里。</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-black/6">
          {notifications.map((notification) => {
            const markReadAction = markNotificationRead.bind(null, {
              notificationId: notification.id,
            });

            return (
              <li
                key={notification.id}
                className={`flex gap-3 py-5 ${notification.readAt ? '' : 'bg-[#2383e2]/3'}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-2 size-2 shrink-0 rounded-full ${
                    notification.readAt ? 'bg-transparent' : 'bg-[#2383e2]'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[#202124]">{notification.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#666a70]">{notification.body}</p>
                  <time
                    className="mt-2 block text-xs text-[#9a9da1]"
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
                      className="grid size-8 place-items-center rounded-lg text-[#777b80] transition-colors hover:bg-black/5 hover:text-[#202124]"
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
      )}
    </div>
  );
}
