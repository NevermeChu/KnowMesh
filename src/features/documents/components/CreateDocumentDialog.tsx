'use client';

import { useState, useTransition } from 'react';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogButton,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
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
        <ModalDialogBody>
          <label htmlFor="document-title" className="block text-xs font-medium text-ink-secondary">
            文件名
          </label>
          <input
            autoFocus
            id="document-title"
            type="text"
            aria-label="文件名"
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-lg border border-line bg-card px-3 text-sm transition-colors outline-none placeholder:text-ink-faint-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
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
