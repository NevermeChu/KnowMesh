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
import { createProjectSchema } from '../CreateProjectSchema';
import type { ProjectArea } from '../Project';
import { createProject } from '../server/CreateProject';

export function CreateProjectDialog(props: {
  area: ProjectArea;
  onClose: () => void;
  workspaceId: string;
}) {
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const sectionLabel = props.area === 'personal' ? '个人区域' : '协作区域';

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: '关闭创建项目弹窗',
        isDisabled: isPending,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-96"
      titleId="create-project-title"
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭', isDisabled: isPending, onClick: props.onClose }}
        description={`项目将创建在${sectionLabel}中`}
        title="创建项目"
        titleId="create-project-title"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const result = createProjectSchema.safeParse({
            name,
            workspaceId: props.workspaceId,
          });

          if (!result.success) {
            setError(result.error.issues[0]?.message ?? '项目名称无效');
            return;
          }

          startTransition(async () => {
            try {
              await createProject(result.data);
              props.onClose();
            } catch {
              setError('创建项目失败，请稍后重试');
            }
          });
        }}
      >
        <ModalDialogBody>
          <FormField error={error} htmlFor="project-name" label="项目名称">
            <Input
              autoComplete="off"
              autoFocus
              disabled={isPending}
              hasError={Boolean(error)}
              id="project-name"
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
                if (error) {
                  setError(undefined);
                }
              }}
              placeholder="输入项目名称"
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
