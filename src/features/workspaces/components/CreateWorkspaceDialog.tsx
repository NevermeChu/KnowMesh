'use client';

import { useState, useTransition } from 'react';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogButton,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import { createWorkspace } from '../server/CreateWorkspace';
import { createWorkspaceSchema } from '../WorkspaceSchema';

export function CreateWorkspaceDialog(props: { onClose: () => void; onCreated: () => void }) {
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: '关闭创建工作区弹窗',
        isDisabled: isPending,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-88"
      titleId="create-workspace-title"
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭', isDisabled: isPending, onClick: props.onClose }}
        description="工作区用于组织个人与协作项目"
        title="创建工作区"
        titleId="create-workspace-title"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const result = createWorkspaceSchema.safeParse({ name });

          if (!result.success) {
            setError(result.error.issues[0]?.message ?? '工作区名称无效');
            return;
          }

          startTransition(async () => {
            try {
              await createWorkspace(result.data);
              props.onCreated();
            } catch {
              setError('创建工作区失败，请稍后重试');
            }
          });
        }}
      >
        <ModalDialogBody>
          <label htmlFor="workspace-name" className="block text-xs font-medium text-ink-secondary">
            工作区名称
          </label>
          <input
            autoFocus
            id="workspace-name"
            type="text"
            aria-label="工作区名称"
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-lg border border-line bg-card px-3 text-sm transition-colors outline-none placeholder:text-ink-faint-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
            disabled={isPending}
            maxLength={80}
            placeholder="例如：产品团队"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) {
                setError(undefined);
              }
            }}
          />
          <p className="mt-1.5 min-h-4 text-xs text-danger" role="alert">
            {error}
          </p>
        </ModalDialogBody>
        <ModalDialogFooter>
          <ModalDialogButton type="button" disabled={isPending} onClick={props.onClose}>
            取消
          </ModalDialogButton>
          <ModalDialogButton type="submit" disabled={isPending} variant="primary">
            {isPending ? '创建中…' : '创建'}
          </ModalDialogButton>
        </ModalDialogFooter>
      </form>
    </ModalDialog>
  );
}
