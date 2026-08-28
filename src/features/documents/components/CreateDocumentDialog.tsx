'use client';

import { FileText, Shapes } from 'lucide-react';
import { useState } from 'react';
import { CreateNamedResourceDialog } from '@/components/ui/CreateNamedResourceDialog';
import type { DocumentKind } from '../Document';
import { createDocumentSchema } from '../DocumentSchema';
import { createDocument } from '../server/CreateDocument';

export function CreateDocumentDialog(props: {
  parentDocument?: { id: string; title: string };
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (documentId: string) => void;
}) {
  const [kind, setKind] = useState<DocumentKind>('rich-text');
  const description = props.parentDocument
    ? `文件将创建在 ${props.projectName} 的「${props.parentDocument.title}」下`
    : `文件将创建在${props.projectName}中`;

  return (
    <CreateNamedResourceDialog
      additionalFields={(isPending) => (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink">文件类型</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { icon: FileText, kind: 'rich-text', label: '富文本文档' },
                { icon: Shapes, kind: 'whiteboard', label: '白板' },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <label
                  key={option.kind}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    kind === option.kind
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line text-ink-muted hover:bg-overlay hover:text-ink'
                  } ${isPending ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    aria-label={option.label}
                    checked={kind === option.kind}
                    className="sr-only"
                    disabled={isPending}
                    name="document-kind"
                    onChange={() => {
                      setKind(option.kind);
                    }}
                    type="radio"
                    value={option.kind}
                  />
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
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
          kind,
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
