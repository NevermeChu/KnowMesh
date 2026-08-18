'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import type { MemberRole } from '@/features/permissions/Permission';
import {
  acceptProjectInvitation,
  rejectProjectInvitation,
  requestProjectAccess,
} from '@/features/permissions/server/ProjectMembers';

export function ProjectAccessActions(props: {
  hasInvitation: boolean;
  projectId: string;
  projectRole: MemberRole | null;
  requestedRole: MemberRole | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestedRole = props.projectRole === 'viewer' ? 'editor' : 'viewer';
  const isInvitationPending = props.hasInvitation && !props.projectRole;
  const actionLabel = requestedRole === 'editor' ? '申请编辑权限' : '申请查看权限';

  if (props.projectRole === 'editor' || props.projectRole === 'owner') {
    return null;
  }

  if (props.requestedRole) {
    return <p className="mt-4 text-sm text-ink-muted">权限申请已提交，等待项目管理员处理。</p>;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {isInvitationPending ? (
        <>
          <Button
            type="button"
            variant="primary"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await acceptProjectInvitation({ projectId: props.projectId });
                  router.refresh();
                } catch {
                  setError('接受邀请失败，请稍后重试。');
                }
              });
            }}
          >
            接受项目邀请
          </Button>
          <Button
            type="button"
            variant="neutral"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await rejectProjectInvitation({ projectId: props.projectId });
                  router.refresh();
                } catch {
                  setError('拒绝邀请失败，请稍后重试。');
                }
              });
            }}
          >
            拒绝邀请
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="primary"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await requestProjectAccess({ projectId: props.projectId, requestedRole });
                router.refresh();
              } catch {
                setError('权限操作失败，请稍后重试。');
              }
            });
          }}
        >
          {actionLabel}
        </Button>
      )}
      {error && <p className="mt-2 w-full text-xs text-danger-strong">{error}</p>}
    </div>
  );
}
