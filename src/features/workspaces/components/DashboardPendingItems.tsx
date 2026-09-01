'use client';

import { ArrowRight, Inbox, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { openPermissionOverviewModal } from '@/components/layout/ShellEvents';
import { Button } from '@/components/ui/Button';
import { isFailedMemberAction } from '@/features/permissions/MemberWorkflow';
import type { PendingApprovalItem } from '@/features/permissions/server/GetPendingApprovals';
import {
  approveProjectAccessRequest,
  rejectProjectAccessRequest,
} from '@/features/permissions/server/ProjectMembers';
import {
  acceptWorkspaceInvitationInApp,
  approveWorkspaceAccessRequest,
  declineWorkspaceInvitationInApp,
  rejectWorkspaceAccessRequest,
} from '@/features/permissions/server/WorkspaceMembers';
import type { PendingInvitationItem } from '@/features/workspaces/server/GetPendingInvitations';

const requestedRoleLabels: Record<string, string> = {
  editor: '可编辑',
  viewer: '只读',
};

export function DashboardPendingItems(props: {
  pendingApprovals: PendingApprovalItem[];
  pendingInvitations: PendingInvitationItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [handledIds, setHandledIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const activeInvitations = props.pendingInvitations.filter(
    (invitation) => !handledIds.has(`invitation-${invitation.workspaceId}`),
  );
  const activeApprovals = props.pendingApprovals.filter(
    (approval) =>
      !handledIds.has(`approval-${approval.kind}-${approval.resourceId}-${approval.memberUserId}`),
  );

  const handleAction = (id: string, actionFn: () => Promise<unknown>) => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await actionFn();
        if (isFailedMemberAction(result)) {
          setActionError(result.error);
          return;
        }
        setHandledIds((prev) => new Set([...prev, id]));
      } catch (error) {
        setActionError(error instanceof Error ? error.message : '操作失败，请刷新重试');
      }
    });
  };

  if (activeInvitations.length === 0 && activeApprovals.length === 0) {
    return <p className="text-xs leading-relaxed text-ink-muted">暂无待处理的邀请与协作请求。</p>;
  }

  return (
    <div className="space-y-4">
      {actionError && <p className="text-xs text-danger-strong">{actionError}</p>}
      <ul className="space-y-3.5">
        {activeInvitations.map((invitation) => {
          const itemKey = `invitation-${invitation.workspaceId}`;
          return (
            <li
              key={invitation.workspaceId}
              className="flex flex-col gap-2 rounded-lg bg-surface/50 p-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <Inbox
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  strokeWidth={1.8}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">
                    「{invitation.workspaceName}」邀请你加入
                  </span>
                  <Link
                    href={`/invitations/accept?workspace=${invitation.workspaceId}`}
                    className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-accent transition-colors hover:underline"
                  >
                    查看邀请详情
                    <ArrowRight aria-hidden="true" className="size-3" />
                  </Link>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                <Button
                  disabled={isPending}
                  onClick={() => {
                    handleAction(itemKey, async () => {
                      await declineWorkspaceInvitationInApp({
                        workspaceId: invitation.workspaceId,
                      });
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  忽略
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => {
                    handleAction(itemKey, async () => {
                      await acceptWorkspaceInvitationInApp({ workspaceId: invitation.workspaceId });
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="primary"
                >
                  接受
                </Button>
              </div>
            </li>
          );
        })}
        {activeApprovals.map((approval) => {
          const itemKey = `approval-${approval.kind}-${approval.resourceId}-${approval.memberUserId}`;
          return (
            <li
              key={itemKey}
              className="flex flex-col gap-2 rounded-lg bg-surface/50 p-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  strokeWidth={1.8}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">
                    {approval.requesterName} 申请加入「{approval.resourceName}」
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                    <span>
                      申请{approval.kind === 'workspace' ? '工作区' : '项目'}
                      {requestedRoleLabels[approval.requestedRole] ?? approval.requestedRole}权限
                    </span>
                    <button
                      onClick={() => {
                        if (approval.kind === 'workspace') {
                          openPermissionOverviewModal({
                            scope: 'workspace',
                            workspaceId: approval.resourceId,
                          });
                        } else {
                          openPermissionOverviewModal({
                            projectId: approval.resourceId,
                            scope: 'project',
                          });
                        }
                      }}
                      type="button"
                      className="cursor-pointer text-accent transition-colors hover:underline"
                    >
                      管理权限
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                <Button
                  disabled={isPending}
                  onClick={() => {
                    handleAction(itemKey, async () => {
                      await (approval.kind === 'workspace'
                        ? rejectWorkspaceAccessRequest({
                            memberUserId: approval.memberUserId,
                            workspaceId: approval.resourceId,
                          })
                        : rejectProjectAccessRequest({
                            memberUserId: approval.memberUserId,
                            projectId: approval.resourceId,
                          }));
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  拒绝
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => {
                    handleAction(itemKey, async () => {
                      await (approval.kind === 'workspace'
                        ? approveWorkspaceAccessRequest({
                            memberUserId: approval.memberUserId,
                            workspaceId: approval.resourceId,
                          })
                        : approveProjectAccessRequest({
                            memberUserId: approval.memberUserId,
                            projectId: approval.resourceId,
                          }));
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="primary"
                >
                  批准
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
