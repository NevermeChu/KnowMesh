'use client';

import { X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
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

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-100 flex overflow-y-auto p-4">
      <button
        type="button"
        aria-label="关闭新建文件弹窗"
        className="absolute inset-0 size-full bg-black/20"
        disabled={isPending}
        onClick={props.onClose}
      />
      <dialog
        open
        aria-labelledby="create-document-title"
        aria-modal="true"
        className="relative z-10 m-auto w-full max-w-88 rounded-xl border border-black/10 bg-white p-4 text-[#2f3437] shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !isPending) {
            props.onClose();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="create-document-title" className="text-sm font-semibold text-[#202124]">
              新建文件
            </h2>
            <p className="mt-0.5 text-xs text-[#8a8d91]">文件将创建在{props.projectName}中</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            className="grid size-7 shrink-0 place-items-center rounded-md text-[#8a8d91] transition-colors hover:bg-black/5 hover:text-[#202124]"
            disabled={isPending}
            onClick={props.onClose}
          >
            <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </button>
        </div>

        <form
          className="mt-4"
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
      </dialog>
    </div>,
    document.body,
  );
}
