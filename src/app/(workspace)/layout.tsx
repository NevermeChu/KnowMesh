import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { getDocumentNavigation } from '@/features/documents/server/GetDocumentNavigation';
import { getProjects } from '@/features/projects/server/GetProjects';
import { getWorkspaceContext } from '@/features/workspaces/server/GetWorkspaceContext';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} 工作台`,
  description: '管理团队知识空间与个人账户。',
};

export default async function WorkspaceLayout(props: { children: React.ReactNode }) {
  const workspaceContext = await getWorkspaceContext();
  const [documents, projects] = workspaceContext.activeWorkspace
    ? await Promise.all([
        getDocumentNavigation({ workspaceId: workspaceContext.activeWorkspace.id }),
        getProjects({ workspaceId: workspaceContext.activeWorkspace.id }),
      ])
    : [[], []];

  return (
    <AppShell
      activeWorkspace={workspaceContext.activeWorkspace}
      documents={documents}
      projects={projects}
      workspaces={workspaceContext.workspaces}
    >
      {props.children}
    </AppShell>
  );
}
