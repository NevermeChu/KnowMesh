'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ModalDialogButton } from '@/components/ui/ModalDialog';
import type { MemberRole } from '@/features/permissions/Permission';
import {
  acceptProjectInvitation,
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
  let actionLabel = requestedRole === 'editor' ? '申请编辑权限' : '申请查看权限';

  if (props.hasInvitation && !props.projectRole) {
    actionLabel = '接受项目邀请';
  }

  if (props.projectRole === 'editor' || props.projectRole === 'owner') {
    return null;
  }

  if (props.requestedRole) {
    return <p className="mt-4 text-sm text-ink-muted">权限申请已提交，等待项目管理员处理。</p>;
  }

  return (
    <div className="mt-4">
      <ModalDialogButton
        type="button"
        variant="primary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await (props.hasInvitation && !props.projectRole
                ? acceptProjectInvitation({ projectId: props.projectId })
                : requestProjectAccess({ projectId: props.projectId, requestedRole }));
              router.refresh();
            } catch {
              setError('权限操作失败，请稍后重试。');
            }
          });
        }}
      >
        {actionLabel}
      </ModalDialogButton>
      {error && <p className="mt-2 text-xs text-danger-strong">{error}</p>}
    </div>
  );
}
