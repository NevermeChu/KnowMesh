import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { RealtimeNotificationProvider } from '@/features/notifications/context/RealtimeNotificationContext';
import { getUnreadNotificationCount } from '@/features/notifications/server/GetNotifications';
import { CONTENT_WIDTH_COOKIE, parseContentWidth } from '@/features/preferences/Preferences';
import { getWorkspaceContext } from '@/features/workspaces/server/GetWorkspaceContext';
import { getWorkspaceNavigation } from '@/features/workspaces/server/GetWorkspaceNavigation';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  title: `${AppConfig.name} 工作台`,
  description: '管理团队知识空间与个人账户。',
};

export default async function WorkspaceLayout(props: { children: React.ReactNode }) {
  const [workspaceContext, user] = await Promise.all([getWorkspaceContext(), requireUser()]);
  const workspaceIds = [
    workspaceContext.personalWorkspace?.id,
    workspaceContext.activeWorkspace?.kind === 'team'
      ? workspaceContext.activeWorkspace.id
      : undefined,
  ].filter((workspaceId): workspaceId is string => typeof workspaceId === 'string');
  const [workspaceResources, unreadNotificationCount, cookieStore] = await Promise.all([
    Promise.all(
      workspaceIds.map(async (workspaceId) => await getWorkspaceNavigation({ workspaceId })),
    ),
    getUnreadNotificationCount(),
    cookies(),
  ]);
  const projects = workspaceResources.flatMap((resources) => resources.projects);
  const contentWidth = parseContentWidth(cookieStore.get(CONTENT_WIDTH_COOKIE)?.value);

  return (
    <RealtimeNotificationProvider initialUnreadCount={unreadNotificationCount}>
      <AppShell
        activeWorkspace={workspaceContext.activeWorkspace}
        contentWidth={contentWidth}
        currentUserId={user.id}
        projects={projects}
        workspaces={workspaceContext.workspaces}
      >
        {props.children}
      </AppShell>
    </RealtimeNotificationProvider>
  );
}
