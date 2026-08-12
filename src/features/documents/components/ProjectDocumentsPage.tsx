import { notFound } from 'next/navigation';
import { AppSectionPlaceholder } from '@/components/layout/AppSectionPlaceholder';
import type { ProjectArea } from '@/features/projects/Project';
import { getWorkspaceContext } from '@/features/workspaces/server/GetWorkspaceContext';
import { createDocumentSchema } from '../DocumentSchema';
import { getProjectDocuments } from '../server/GetProjectDocuments';
import { DocumentWorkspace } from './DocumentWorkspace';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const getStringParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export async function ProjectDocumentsPage(props: {
  area: ProjectArea;
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const projectId = getStringParam(searchParams.project);
  const documentId = getStringParam(searchParams.document);
  const sectionLabel = props.area === 'personal' ? '个人区域' : '协作区域';
  const { activeWorkspace, personalWorkspace } = await getWorkspaceContext();
  const targetWorkspace = props.area === 'personal' ? personalWorkspace : activeWorkspace;

  if (!targetWorkspace || (props.area === 'collaboration' && targetWorkspace.kind !== 'team')) {
    return (
      <AppSectionPlaceholder
        eyebrow="工作区"
        title="创建或选择团队工作区"
        description="协作区域只在团队工作区中可用。"
      />
    );
  }

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

  const result = await getProjectDocuments({
    documentId,
    projectId,
    workspaceId: targetWorkspace.id,
    workspaceKind: targetWorkspace.kind,
  });

  if (!result) {
    notFound();
  }

  return (
    <DocumentWorkspace
      canEdit={result.access.permissions.includes('document.update')}
      documentCount={result.documents.length}
      selectedDocument={result.selectedDocument}
    />
  );
}
