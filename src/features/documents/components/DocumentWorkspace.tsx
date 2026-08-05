import { FileText } from 'lucide-react';
import type { Document } from '../Document';
import { DocumentEditor } from './DocumentEditor';

export function DocumentWorkspace(props: {
  canEdit: boolean;
  documentCount: number;
  selectedDocument: Document | null;
}) {
  return (
    <div className="-mx-5 min-h-[calc(100dvh-7rem)] px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <section className="min-w-0">
        {props.selectedDocument ? (
          <DocumentEditor
            key={props.selectedDocument.id}
            canEdit={props.canEdit}
            document={props.selectedDocument}
          />
        ) : (
          <div className="mx-auto flex min-h-[28rem] max-w-lg flex-col items-center justify-center text-center">
            <FileText aria-hidden="true" className="size-9 text-[#b0b3b7]" strokeWidth={1.5} />
            <h2 className="mt-4 text-lg font-semibold text-[#2f3437]">选择一篇文档</h2>
            <p className="mt-2 text-sm leading-6 text-[#777b80]">
              {props.documentCount === 0 && props.canEdit
                ? '点击左侧项目名称旁的加号创建第一篇文档。'
                : '从左侧文档列表中选择要查看的内容。'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
