'use client';

import { CircleCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ModalDialogButton } from '@/components/ui/ModalDialog';
import { acceptWorkspaceInvitation } from '@/features/permissions/server/WorkspaceMembers';
import type { WorkspaceInvitationPageData } from '@/features/workspaces/WorkspaceInvitation';
import { workspaceInvitationCopy } from '@/features/workspaces/WorkspaceInvitation';

const invitationStatusMessages = {
  accepted: {
    description: '这份邀请已经被接受，无需重复操作。',
    title: '邀请已处理',
  },
  'email-mismatch': {
    description: '请使用收到邀请的邮箱登录，然后重新打开邮件中的链接。',
    title: '当前账号与邀请不匹配',
  },
  expired: {
    description: '这份邀请已超过有效期，请联系工作区管理员重新发送。',
    title: '邀请已过期',
  },
  invalid: {
    description: '该链接不完整或已失效，请从邀请邮件中重新打开。',
    title: '邀请链接无效',
  },
  revoked: {
    description: '工作区管理员已撤销这份邀请。',
    title: '邀请已撤销',
  },
} as const;

export function AcceptWorkspaceInvitation(props: {
  data: WorkspaceInvitationPageData;
  registrationSucceeded: boolean;
  token: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (props.data.status !== 'ready') {
    const message = invitationStatusMessages[props.data.status];

    return (
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-xl items-center py-12">
        <section className="w-full rounded-2xl border border-line bg-card px-6 py-10 text-center shadow-card sm:px-10">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-ink text-lg font-semibold text-canvas">
            K
          </div>
          <p className="mt-6 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">
            {workspaceInvitationCopy.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{message.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
            {message.description}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-xl items-center py-12">
      <section className="w-full overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        {props.registrationSucceeded && (
          <div className="flex items-start gap-3 border-b border-accent/15 bg-accent-soft px-6 py-4 text-sm sm:px-10">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.8} />
            <div>
              <p className="font-semibold text-ink">注册成功，邮箱已验证</p>
              <p className="mt-0.5 leading-5 text-ink-muted">你已自动登录，现在可以接受邀请。</p>
            </div>
          </div>
        )}
        <header className="px-6 pt-8 text-center sm:px-10">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-ink text-lg font-semibold text-canvas">
            K
          </div>
          <p className="mt-6 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
            {workspaceInvitationCopy.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{workspaceInvitationCopy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            <span className="font-medium text-ink">{props.data.invitation.inviterName}</span>{' '}
            邀请你加入以下工作区。
          </p>
        </header>

        <dl className="mx-6 mt-7 divide-y divide-line-soft rounded-xl bg-surface px-5 sm:mx-10">
          <div className="py-4">
            <dt className="text-xs text-ink-muted">工作区</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {props.data.invitation.workspaceName}
            </dd>
          </div>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">加入角色</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {props.data.invitation.roleLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">受邀邮箱</dt>
              <dd className="mt-1 truncate text-sm font-medium text-ink">
                {props.data.invitation.inviteeEmail}
              </dd>
            </div>
          </div>
          <div className="py-4">
            <dt className="text-xs text-ink-muted">有效期</dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {props.data.invitation.expiresAtLabel}
            </dd>
          </div>
        </dl>

        <footer className="mt-7 border-t border-line-soft px-6 py-5 sm:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-ink-muted">加入后将以 Viewer 角色访问工作区。</p>
            <ModalDialogButton
              type="button"
              variant="primary"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await acceptWorkspaceInvitation({ token: props.token });
                    router.push('/dashboard');
                    router.refresh();
                  } catch {
                    setError('邀请状态已变更。请刷新页面后重试。');
                  }
                });
              }}
            >
              {isPending ? '正在加入…' : '接受邀请'}
            </ModalDialogButton>
          </div>
          {error && <p className="mt-3 text-sm text-danger-strong">{error}</p>}
        </footer>
      </section>
    </div>
  );
}
