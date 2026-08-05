import { notFound } from 'next/navigation';
import { AppSectionPlaceholder } from '@/components/layout/AppSectionPlaceholder';
import type { ProjectKind } from '@/features/projects/Project';
import { canEditDocuments } from '../Document';
import { createDocumentSchema } from '../DocumentSchema';
import { getProjectDocuments } from '../server/GetProjectDocuments';
import { DocumentWorkspace } from './DocumentWorkspace';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const getStringParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export async function ProjectDocumentsPage(props: {
  kind: ProjectKind;
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const projectId = getStringParam(searchParams.project);
  const documentId = getStringParam(searchParams.document);
  const sectionLabel = props.kind === 'personal' ? '个人工作区' : '协作区';

  if (!projectId) {
    return (
      <AppSectionPlaceholder
        eyebrow={sectionLabel}
        title={`选择${sectionLabel}项目`}
        description="从左侧导航选择一个项目，或创建新项目后开始整理文档。"
      />
    );
  }

  if (!createDocumentSchema.shape.projectId.safeParse(projectId).success) {
    notFound();
  }

  const result = await getProjectDocuments({ documentId, kind: props.kind, projectId });

  if (!result) {
    notFound();
  }

  return (
    <DocumentWorkspace
      canEdit={canEditDocuments(result.access.role)}
      documentCount={result.documents.length}
      selectedDocument={result.selectedDocument}
    />
  );
}
