'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import { transferProjectOwnership } from '@/features/permissions/server/ProjectMembers';
import { transferWorkspaceOwnership } from '@/features/permissions/server/WorkspaceMembers';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { getResourceDetails } from './helpers';

/**
 * Secondary confirmation dialog for transferring workspace or project ownership.
 *
 * @param props - Target member, overview context, close callback, and mutation notifier.
 * @returns The transfer ownership confirmation modal.
 */
export function PermissionTransferConfirmationDialog(props: {
  member: PermissionOverview['groups'][number]['members'][number];
  onClose: () => void;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
}) {
  const resource = getResourceDetails(props.overview);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: `关闭转让${resource.label}所有权确认窗口`,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-96"
      titleId="permission-transfer-confirmation-title"
    >
      <ModalDialogHeader
        closeButton={{
          ariaLabel: `关闭转让${resource.label}所有权确认窗口`,
          onClick: props.onClose,
        }}
        title={`转让${resource.label}所有权`}
        titleId="permission-transfer-confirmation-title"
      />
      <ModalDialogBody>
        <p className="text-sm leading-6 text-ink-secondary">
          确定要将{resource.label}“<span className="font-semibold text-ink">{resource.name}</span>
          ”的所有权转让给“<span className="font-semibold text-ink">{props.member.displayName}</span>
          ”吗？
        </p>
        <p className="mt-2 rounded-lg bg-amber-500/10 p-2.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
          转让后你将成为编辑者（Editor），且该操作无法撤销。
        </p>
        {error && (
          <p className="mt-3 text-sm text-danger-strong" role="alert">
            {error}
          </p>
        )}
      </ModalDialogBody>
      <ModalDialogFooter>
        <Button disabled={isPending} onClick={props.onClose} type="button">
          取消
        </Button>
        <Button
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                if (props.overview.scope === 'workspace') {
                  await transferWorkspaceOwnership({
                    targetUserId: props.member.userId,
                    workspaceId: resource.id,
                  });
                } else if (props.overview.scope === 'project') {
                  await transferProjectOwnership({
                    projectId: resource.id,
                    targetUserId: props.member.userId,
                  });
                }
                props.onClose();
                props.onMutated('update', props.overview.scope);
              } catch (caughtError) {
                setError(
                  caughtError instanceof Error
                    ? caughtError.message
                    : `转让${resource.label}所有权失败，请稍后重试`,
                );
              }
            });
          }}
          type="button"
          variant="primary"
        >
          {isPending ? '转让中…' : '确认转让'}
        </Button>
      </ModalDialogFooter>
    </ModalDialog>
  );
}
