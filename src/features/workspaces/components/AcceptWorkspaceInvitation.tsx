'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ModalDialogButton } from '@/components/ui/ModalDialog';
import { acceptWorkspaceInvitation } from '@/features/permissions/server/WorkspaceMembers';

export function AcceptWorkspaceInvitation(props: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-lg py-20">
      <h1 className="text-2xl font-semibold text-[#202124]">接受工作区邀请</h1>
      <p className="mt-3 text-sm leading-6 text-[#666a70]">
        接受后，你将按照邀请中指定的角色加入工作区。
      </p>
      <div className="mt-6">
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
                setError('邀请无效、已过期，或邀请邮箱与当前账号不匹配。');
              }
            });
          }}
        >
          {isPending ? '正在加入…' : '接受邀请'}
        </ModalDialogButton>
      </div>
      {error && <p className="mt-4 text-sm text-[#b52e2e]">{error}</p>}
    </div>
  );
}
