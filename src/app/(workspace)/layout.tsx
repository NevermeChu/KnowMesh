import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { getWorkspaceContext } from '@/features/workspaces/server/GetWorkspaceContext';
import { getWorkspaceNavigation } from '@/features/workspaces/server/GetWorkspaceNavigation';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} 工作台`,
  description: '管理团队知识空间与个人账户。',
};

export default async function WorkspaceLayout(props: { children: React.ReactNode }) {
  const workspaceContext = await getWorkspaceContext();
  const workspaceIds = [
    workspaceContext.personalWorkspace?.id,
    workspaceContext.activeWorkspace?.kind === 'team'
      ? workspaceContext.activeWorkspace.id
      : undefined,
  ].filter((workspaceId): workspaceId is string => typeof workspaceId === 'string');
  const workspaceResources = await Promise.all(
    workspaceIds.map(async (workspaceId) => await getWorkspaceNavigation({ workspaceId })),
  );
  const documents = workspaceResources.flatMap((resources) => resources.documents);
  const projects = workspaceResources.flatMap((resources) => resources.projects);

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
