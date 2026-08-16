import { FileText } from 'lucide-react';
import { ProjectAccessActions } from '@/features/projects/components/ProjectAccessActions';
import type { Document } from '../Document';
import { DocumentEditor } from './DocumentEditor';

type DocumentAccessState = {
  hasInvitation: boolean;
  projectId: string;
  projectRole: 'editor' | 'owner' | 'viewer' | null;
  requestedRole: 'editor' | 'owner' | 'viewer' | null;
};

function DocumentPlaceholder(props: {
  accessState: DocumentAccessState;
  canEdit: boolean;
  canRead: boolean;
  documentCount: number;
  title?: string;
}) {
  let description = '从左侧文档列表中选择要查看的内容。';

  if (!props.canRead) {
    description = '你可以看到项目的文件结构，但需要加入项目后才能读取正文。';
  } else if (props.documentCount === 0 && props.canEdit) {
    description = '点击左侧项目名称旁的加号创建第一篇文档。';
  }

  return (
    <div className="mx-auto flex min-h-[28rem] max-w-lg flex-col items-center justify-center text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface text-ink-muted">
        <FileText aria-hidden="true" className="size-5" strokeWidth={1.6} />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{props.title ?? '选择一篇文档'}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
      {!props.canRead && <ProjectAccessActions {...props.accessState} />}
    </div>
  );
}

export function DocumentWorkspace(props: {
  accessState: DocumentAccessState;
  canEdit: boolean;
  canRead: boolean;
  documentCount: number;
  selectedDocument: Document | null;
  selectedDocumentTitle: string | null;
}) {
  let content = (
    <DocumentPlaceholder
      accessState={props.accessState}
      canEdit={props.canEdit}
      canRead={props.canRead}
      documentCount={props.documentCount}
    />
  );

  if (props.selectedDocumentTitle && !props.canRead) {
    content = (
      <DocumentPlaceholder
        accessState={props.accessState}
        canEdit={props.canEdit}
        canRead={props.canRead}
        documentCount={props.documentCount}
        title={props.selectedDocumentTitle}
      />
    );
  }

  if (props.selectedDocument) {
    content = (
      <DocumentEditor
        key={props.selectedDocument.id}
        canEdit={props.canEdit}
        document={props.selectedDocument}
      />
    );
  }

  return (
    <div className="-mx-5 min-h-[calc(100dvh-var(--content-top-offset))] px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <section className="min-w-0">{content}</section>
    </div>
  );
}
