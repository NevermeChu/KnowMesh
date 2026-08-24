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
import { createDocumentSchema } from '../DocumentSchema';
import { createDocument } from '../server/CreateDocument';

export function CreateDocumentDialog(props: {
  parentDocument?: { id: string; title: string };
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (documentId: string) => void;
}) {
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  const description = props.parentDocument
    ? `文件将创建在 ${props.projectName} 的「${props.parentDocument.title}」下`
    : `文件将创建在${props.projectName}中`;

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: '关闭新建文件弹窗',
        isDisabled: isPending,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-96"
      titleId="create-document-title"
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭', isDisabled: isPending, onClick: props.onClose }}
        description={description}
        title={props.parentDocument ? '新建子文件' : '新建文件'}
        titleId="create-document-title"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const result = createDocumentSchema.safeParse({
            parentId: props.parentDocument?.id,
            projectId: props.projectId,
            title,
          });

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
          <FormField error={error} htmlFor="document-title" label="文件名">
            <Input
              autoComplete="off"
              autoFocus
              disabled={isPending}
              hasError={Boolean(error)}
              id="document-title"
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
                if (error) {
                  setError(undefined);
                }
              }}
              placeholder="输入文件名"
              value={title}
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
