'use client';

import { CreateNamedResourceDialog } from '@/components/ui/CreateNamedResourceDialog';
import { createDocumentSchema } from '../DocumentSchema';
import { createDocument } from '../server/CreateDocument';

export function CreateDocumentDialog(props: {
  parentDocument?: { id: string; title: string };
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (documentId: string) => void;
}) {
  const description = props.parentDocument
    ? `文件将创建在 ${props.projectName} 的「${props.parentDocument.title}」下`
    : `文件将创建在${props.projectName}中`;

  return (
    <CreateNamedResourceDialog
      closeAriaLabel="关闭新建文件弹窗"
      description={description}
      failureMessage="新建文件失败，请稍后重试"
      fieldId="document-title"
      fieldLabel="文件名"
      invalidNameMessage="文件名无效"
      maxLength={200}
      nameSchema={createDocumentSchema.shape.title}
      onClose={props.onClose}
      onCreate={async (title) => {
        const document = await createDocument({
          parentId: props.parentDocument?.id,
          projectId: props.projectId,
          title,
        });
        props.onCreated(document.id);
      }}
      placeholder="输入文件名"
      title={props.parentDocument ? '新建子文件' : '新建文件'}
      titleId="create-document-title"
    />
  );
}
