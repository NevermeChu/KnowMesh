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
      surfaceClassName="w-full max-w-96"
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
          <FormField error={error} htmlFor="workspace-name" label="工作区名称">
            <Input
              autoComplete="off"
              autoFocus
              disabled={isPending}
              hasError={Boolean(error)}
              id="workspace-name"
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
                if (error) {
                  setError(undefined);
                }
              }}
              placeholder="例如：产品团队"
              value={name}
            />
          </FormField>
        </ModalDialogBody>
        <ModalDialogFooter>
          <Button disabled={isPending} onClick={props.onClose} type="button">
            取消
          </Button>
          <Button disabled={isPending} type="submit" variant="primary">
            {isPending ? '创建中…' : '创建'}
          </Button>
        </ModalDialogFooter>
      </form>
    </ModalDialog>
  );
}
