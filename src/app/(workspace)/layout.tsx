import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { getDocumentNavigation } from '@/features/documents/server/GetDocumentNavigation';
import { getProjects } from '@/features/projects/server/GetProjects';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} 工作台`,
  description: '管理团队知识空间与个人账户。',
};

export default async function WorkspaceLayout(props: { children: React.ReactNode }) {
  const [documents, projects] = await Promise.all([getDocumentNavigation(), getProjects()]);

  return (
    <AppShell documents={documents} projects={projects}>
      {props.children}
    </AppShell>
  );
}
