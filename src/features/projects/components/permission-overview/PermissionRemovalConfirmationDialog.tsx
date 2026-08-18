'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import { deleteDocument } from '@/features/documents/server/DeleteDocument';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { getPermissionOverviewRemovalMode } from '@/features/projects/PermissionOverview';
import { deleteOrLeaveProject } from '@/features/projects/server/DeleteProject';
import { deleteOrLeaveWorkspace } from '@/features/workspaces/server/DeleteWorkspace';
import { getRemovalDescription, getResourceDetails } from './helpers';

/**
 * Secondary confirmation dialog for deleting or leaving a workspace/project/document.
 *
 * @param props - Overview, close callback, and mutation notifier.
 * @returns The confirmation modal.
 */
export function PermissionRemovalConfirmationDialog(props: {
  onClose: () => void;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
}) {
  const resource = getResourceDetails(props.overview);
  const [confirmationName, setConfirmationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const removalMode = getPermissionOverviewRemovalMode(props.overview);
  const actionLabel = removalMode === 'leave' ? '退出' : '删除';

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: `关闭${actionLabel}${resource.label}确认窗口`,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-96"
      titleId="permission-removal-confirmation-title"
    >
      <ModalDialogHeader
        closeButton={{
          ariaLabel: `关闭${actionLabel}${resource.label}确认窗口`,
          onClick: props.onClose,
        }}
        title={`确认${actionLabel}${resource.label}？`}
        titleId="permission-removal-confirmation-title"
      />
      <ModalDialogBody>
        <p className="text-sm leading-6 text-ink-muted">
          {getRemovalDescription({
            overview: props.overview,
            removalMode,
            resourceName: resource.name,
          })}
        </p>
        {removalMode === 'delete' && props.overview.scope === 'workspace' && (
          <div className="mt-4">
            <FormField
              htmlFor="confirmation-workspace-name"
              label="输入工作区名称以确认"
              reserveErrorSpace={false}
            >
              <Input
                aria-label="确认删除的工作区名称"
                disabled={isPending}
                id="confirmation-workspace-name"
                onChange={(event) => {
                  setConfirmationName(event.target.value);
                }}
                value={confirmationName}
              />
            </FormField>
          </div>
        )}
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
          disabled={
            isPending ||
            (removalMode === 'delete' &&
              props.overview.scope === 'workspace' &&
              confirmationName !== resource.name)
          }
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                if (props.overview.scope === 'workspace') {
                  await deleteOrLeaveWorkspace({ workspaceId: resource.id });
                } else if (props.overview.scope === 'project') {
                  await deleteOrLeaveProject({ projectId: resource.id });
                } else {
                  await deleteDocument({ documentId: resource.id });
                }
                props.onMutated('delete', props.overview.scope);
              } catch {
                setError(`${resource.label}${actionLabel}失败，请稍后重试`);
              }
            });
          }}
          type="button"
          variant="danger"
        >
          {isPending ? `${actionLabel}中…` : `${actionLabel}${resource.label}`}
        </Button>
      </ModalDialogFooter>
    </ModalDialog>
  );
}
