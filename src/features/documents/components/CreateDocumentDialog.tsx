'use client';

import { useState, useTransition } from 'react';
import { ModalDialog, ModalDialogHeader } from '@/components/ui/ModalDialog';
import { createDocumentSchema } from '../DocumentSchema';
import { createDocument } from '../server/CreateDocument';

export function CreateDocumentDialog(props: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (documentId: string) => void;
}) {
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: '关闭新建文件弹窗',
        isDisabled: isPending,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-88"
      titleId="create-document-title"
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭', isDisabled: isPending, onClick: props.onClose }}
        description={`文件将创建在${props.projectName}中`}
        title="新建文件"
        titleId="create-document-title"
      />
      <form
        className="px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const result = createDocumentSchema.safeParse({ projectId: props.projectId, title });

          if (!result.success) {
            setError(result.error.issues[0]?.message ?? '文件名无效');
            return;
          }

          startTransition(async () => {
            try {
              const document = await createDocument(result.data);
              props.onCreated(document.id);
            } catch {
              setError('新建文件失败，请稍后重试');
            }
          });
        }}
      >
        <label htmlFor="document-title" className="block text-xs font-medium text-[#555a60]">
          文件名
        </label>
        <input
          autoFocus
          id="document-title"
          type="text"
          aria-label="文件名"
          autoComplete="off"
          className="mt-1.5 h-9 w-full rounded-lg border border-black/12 bg-white px-3 text-sm transition-colors outline-none placeholder:text-[#b0b3b7] focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15"
          disabled={isPending}
          maxLength={200}
          placeholder="输入文件名"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
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
