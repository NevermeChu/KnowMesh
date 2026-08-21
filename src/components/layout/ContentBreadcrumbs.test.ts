import { describe, expect, it } from 'vitest';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import type { Project } from '@/features/projects/Project';
import { createContentBreadcrumbs } from './ContentBreadcrumbs';

const projects: Project[] = [
  {
    id: 'personal-project',
    name: '私人项目',
    permissions: [],
    workspaceKind: 'personal',
  },
  {
    id: 'team-project',
    name: '团队项目',
    permissions: [],
    workspaceKind: 'team',
  },
];
const documents: DocumentNavigationItem[] = [
  { id: 'personal-document', projectId: 'personal-project', title: '私人文档' },
  { id: 'team-document', projectId: 'team-project', title: '团队文档' },
];

describe(createContentBreadcrumbs, () => {
  it('creates localized static route breadcrumbs', () => {
    expect(
      createContentBreadcrumbs({
        documents,
        pathname: '/settings/audit-logs',
        projects,
      }),
    ).toStrictEqual([{ label: '设置' }, { label: '审计日志' }]);
  });

  it('adds selected project to personal area', () => {
    expect(
      createContentBreadcrumbs({
        documents,
        pathname: '/personal',
        projectId: 'personal-project',
        projects,
      }),
    ).toStrictEqual([{ href: '/personal', label: '个人区域' }, { label: '私人项目' }]);
  });

  it('adds selected project and document to collaboration area', () => {
    expect(
      createContentBreadcrumbs({
        documentId: 'team-document',
        documents,
        pathname: '/collaboration',
        projectId: 'team-project',
        projects,
      }),
    ).toStrictEqual([
      { href: '/collaboration', label: '协作区域' },
      { href: '/collaboration?project=team-project', label: '团队项目' },
      { label: '团队文档' },
    ]);
  });

  it('omits resources outside the current area', () => {
    expect(
      createContentBreadcrumbs({
        documentId: 'personal-document',
        documents,
        pathname: '/collaboration',
        projectId: 'personal-project',
        projects,
      }),
    ).toStrictEqual([{ label: '协作区域' }]);
  });
});
