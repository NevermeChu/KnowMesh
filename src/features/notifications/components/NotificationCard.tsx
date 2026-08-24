'use client';

import {
  ArrowRight,
  Bell,
  Check,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { openPermissionOverviewModal } from '@/components/layout/ShellEvents';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { NotificationItem, NotificationType } from '@/features/notifications/Notification';
import { markNotificationRead } from '@/features/notifications/server/NotificationActions';
import {
  acceptProjectInvitation,
  approveProjectAccessRequest,
  rejectProjectAccessRequest,
  rejectProjectInvitation,
} from '@/features/permissions/server/ProjectMembers';
import {
  acceptWorkspaceInvitationInApp,
  approveWorkspaceAccessRequest,
  declineWorkspaceInvitationInApp,
  rejectWorkspaceAccessRequest,
} from '@/features/permissions/server/WorkspaceMembers';

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

export function NotificationCard(props: { notification: NotificationItem }) {
  const [isPending, startTransition] = useTransition();
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const visuals = getNotificationVisuals(props.notification.type);
  const IconComponent = visuals.icon;
  const isUnread = !props.notification.readAt && !actionFeedback;

  const handleAction = (actionFn: () => Promise<unknown>, feedback: string) => {
    startTransition(async () => {
      try {
        await actionFn();
        setActionFeedback(feedback);
      } catch (error) {
        setActionFeedback(error instanceof Error ? error.message : '操作失败，请重试');
      }
    });
  };

  const renderActionButtons = () => {
    if (actionFeedback) {
      return <p className="text-xs font-medium text-accent">{actionFeedback}</p>;
    }

    if (props.notification.type === 'workspace_invited' && props.notification.targetId) {
      const workspaceId = props.notification.targetId;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await acceptWorkspaceInvitationInApp({ workspaceId });
              }, '已接受邀请并加入工作区');
            }}
            size="sm"
            type="button"
            variant="primary"
          >
            {isPending ? '处理中…' : '接受邀请'}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await declineWorkspaceInvitationInApp({ workspaceId });
              }, '已忽略该邀请');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            忽略
          </Button>
          <Link
            href={`/invitations/accept?workspace=${workspaceId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
          >
            查看邀请详情
            <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          </Link>
        </div>
      );
    }

    if (props.notification.type === 'project_invited' && props.notification.targetId) {
      const projectId = props.notification.targetId;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await acceptProjectInvitation({ projectId });
              }, '已接受项目邀请');
            }}
            size="sm"
            type="button"
            variant="primary"
          >
            {isPending ? '处理中…' : '接受邀请'}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await rejectProjectInvitation({ projectId });
              }, '已忽略项目邀请');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            忽略
          </Button>
          <Link
            href={`/collaboration?project=${projectId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
          >
            前往项目
            <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          </Link>
        </div>
      );
    }

    if (
      props.notification.type === 'workspace_access_requested' &&
      props.notification.targetId &&
      props.notification.actorUserId
    ) {
      const workspaceId = props.notification.targetId;
      const memberUserId = props.notification.actorUserId;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await approveWorkspaceAccessRequest({ memberUserId, workspaceId });
              }, '已批准工作区编辑权限');
            }}
            size="sm"
            type="button"
            variant="primary"
          >
            {isPending ? '处理中…' : '批准 (Editor)'}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await rejectWorkspaceAccessRequest({ memberUserId, workspaceId });
              }, '已拒绝权限申请');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            拒绝
          </Button>
          <button
            onClick={() => {
              openPermissionOverviewModal({ scope: 'workspace', workspaceId });
            }}
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
          >
            管理工作区权限
            <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          </button>
        </div>
      );
    }

    if (
      props.notification.type === 'project_access_requested' &&
      props.notification.targetId &&
      props.notification.actorUserId
    ) {
      const projectId = props.notification.targetId;
      const memberUserId = props.notification.actorUserId;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await approveProjectAccessRequest({ memberUserId, projectId });
              }, '已批准项目权限');
            }}
            size="sm"
            type="button"
            variant="primary"
          >
            {isPending ? '处理中…' : '批准申请'}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              handleAction(async () => {
                await rejectProjectAccessRequest({ memberUserId, projectId });
              }, '已拒绝项目申请');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            拒绝
          </Button>
          <button
            onClick={() => {
              openPermissionOverviewModal({ projectId, scope: 'project' });
            }}
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
          >
            管理项目权限
            <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-4">
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
    );
  };

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
            <Badge size="sm" variant="neutral">
              {props.notification.targetKind === 'project' ? '项目' : '工作区'}
            </Badge>
          )}
          {isUnread && <span aria-label="未读" className="size-2 rounded-full bg-accent" />}
        </div>

        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{props.notification.body}</p>

        <div className="mt-3 flex flex-col gap-3">
          <time
            className="text-xs text-ink-faint"
            dateTime={props.notification.createdAt.toISOString()}
          >
            {dateTimeFormatter.format(props.notification.createdAt)}
          </time>
          {renderActionButtons()}
        </div>
      </div>

      {isUnread && (
        <form
          action={() => {
            handleAction(async () => {
              await markNotificationRead({ notificationId: props.notification.id });
            }, '已标为已读');
          }}
          className="shrink-0"
        >
          <Button
            aria-label={`将“${props.notification.title}”标为已读`}
            disabled={isPending}
            icon={<Check aria-hidden="true" className="size-4" strokeWidth={1.8} />}
            size="icon"
            title="标为已读"
            type="submit"
            variant="secondary"
          />
        </form>
      )}
    </li>
  );
}
