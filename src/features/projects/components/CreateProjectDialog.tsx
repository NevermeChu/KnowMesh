'use client';

import { useState, useTransition } from 'react';
import { ModalDialog, ModalDialogHeader } from '@/components/ui/ModalDialog';
import { createProjectSchema } from '../CreateProjectSchema';
import type { ProjectKind } from '../Project';
import { createProject } from '../server/CreateProject';

export function CreateProjectDialog(props: { kind: ProjectKind; onClose: () => void }) {
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const sectionLabel = props.kind === 'personal' ? '个人工作区' : '协作区';

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
        className="px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const result = createProjectSchema.safeParse({ kind: props.kind, name });

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
        <label htmlFor="project-name" className="block text-xs font-medium text-[#555a60]">
          项目名称
        </label>
        <input
          autoFocus
          id="project-name"
          type="text"
          aria-label="项目名称"
          autoComplete="off"
          className="mt-1.5 h-9 w-full rounded-lg border border-black/12 bg-white px-3 text-sm transition-colors outline-none placeholder:text-[#b0b3b7] focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15"
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
        <p className="mt-1.5 min-h-4 text-xs text-[#d14343]" role="alert">
          {error}
        </p>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="h-8 rounded-lg px-3 text-sm font-medium text-[#666a70] transition-colors hover:bg-black/5 hover:text-[#202124]"
            disabled={isPending}
            onClick={props.onClose}
          >
            取消
          </button>
          <button
            type="submit"
            className="h-8 rounded-lg bg-[#2f3437] px-3 text-sm font-medium text-white transition-colors hover:bg-[#202124] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? '创建中…' : '创建'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
