import type { DocumentNavigationItem } from '@/features/documents/Document';
import type { Project } from '@/features/projects/Project';

export type ContentBreadcrumb = {
  href?: string;
  label: string;
};

const routeLabels: Record<string, string> = {
  accept: '接受邀请',
  'audit-logs': '审计日志',
  collaboration: '协作区域',
  dashboard: '首页',
  invitations: '邀请',
  notifications: '通知',
  personal: '个人区域',
  preferences: '系统偏好设置',
  search: '搜索',
  settings: '设置',
  starred: '收藏',
  'user-profile': '账号设置',
};

const navigableBreadcrumbs = new Set(['/collaboration', '/dashboard', '/personal']);
const documentAreas = new Set(['/collaboration', '/personal']);

/**
 * Creates route and resource breadcrumbs for the shared content toolbar.
 *
 * @param options - Current route, selected resources, and accessible navigation metadata.
 * @returns Ordered breadcrumbs with only ancestor items linked.
 */
export function createContentBreadcrumbs(options: {
  documentId?: string;
  documents: DocumentNavigationItem[];
  pathname: string;
  projectId?: string;
  projects: Project[];
}): ContentBreadcrumb[] {
  const segments = options.pathname.split('/').filter(Boolean);
  const breadcrumbs: ContentBreadcrumb[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;
    breadcrumbs.push({
      ...(navigableBreadcrumbs.has(currentPath) ? { href: currentPath } : {}),
      label: routeLabels[segment] ?? segment.replaceAll('-', ' '),
    });
  }

  if (documentAreas.has(options.pathname) && options.projectId) {
    const expectedWorkspaceKind = options.pathname === '/personal' ? 'personal' : 'team';
    const project = options.projects.find(
      (candidate) =>
        candidate.id === options.projectId && candidate.workspaceKind === expectedWorkspaceKind,
    );

    if (project) {
      breadcrumbs.push({
        href: `${options.pathname}?project=${encodeURIComponent(project.id)}`,
        label: project.name,
      });

      const document = options.documents.find(
        (candidate) =>
          candidate.id === options.documentId && candidate.projectId === options.projectId,
      );

      if (document) {
        breadcrumbs.push({ label: document.title });
      }
    }
  }

  return breadcrumbs.map((breadcrumb, index) =>
    index === breadcrumbs.length - 1 ? { label: breadcrumb.label } : breadcrumb,
  );
}
