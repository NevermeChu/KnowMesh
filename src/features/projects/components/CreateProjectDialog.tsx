'use client';

import { useState, useTransition } from 'react';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogButton,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import { createProjectSchema } from '../CreateProjectSchema';
import type { ProjectArea } from '../Project';
import { createProject } from '../server/CreateProject';

export function CreateProjectDialog(props: {
  area: ProjectArea;
  workspaceId: string;
  onClose: () => void;
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
      surfaceClassName="w-full max-w-88"
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
          <label htmlFor="project-name" className="block text-xs font-medium text-ink-secondary">
            项目名称
          </label>
          <input
            autoFocus
            id="project-name"
            type="text"
            aria-label="项目名称"
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-lg border border-line bg-card px-3 text-sm transition-colors outline-none placeholder:text-ink-faint-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
            disabled={isPending}
            maxLength={80}
            placeholder="输入项目名称"
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
