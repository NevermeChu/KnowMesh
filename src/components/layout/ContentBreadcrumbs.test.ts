import { describe, expect, it } from 'vitest';
import { createContentBreadcrumbs } from './ContentBreadcrumbs';

describe(createContentBreadcrumbs, () => {
  it('creates icon-bearing document path in toolbar', () => {
    const breadcrumbs = createContentBreadcrumbs({
      documentId: '30000000-0000-4000-8000-000000000003',
      documents: [
        {
          hasChildren: true,
          id: '30000000-0000-4000-8000-000000000001',
          kind: 'rich-text',
          parentId: null,
          projectId: '20000000-0000-4000-8000-000000000001',
          sortOrder: 0,
          title: '产品设计',
        },
        {
          hasChildren: true,
          id: '30000000-0000-4000-8000-000000000002',
          kind: 'whiteboard',
          parentId: '30000000-0000-4000-8000-000000000001',
          projectId: '20000000-0000-4000-8000-000000000001',
          sortOrder: 0,
          title: '交互规范',
        },
        {
          hasChildren: false,
          id: '30000000-0000-4000-8000-000000000003',
          kind: 'rich-text',
          parentId: '30000000-0000-4000-8000-000000000002',
          projectId: '20000000-0000-4000-8000-000000000001',
          sortOrder: 0,
          title: '面包屑',
        },
      ],
      pathname: '/collaboration',
      projectId: '20000000-0000-4000-8000-000000000001',
      projects: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          name: 'KnowMesh',
          permissions: ['project.read'],
          workspaceKind: 'team',
        },
      ],
    });

    expect(breadcrumbs).toStrictEqual([
      { href: '/collaboration', label: '协作区域' },
      {
        href: '/collaboration?project=20000000-0000-4000-8000-000000000001',
        icon: 'project',
        label: 'KnowMesh',
      },
      {
        href: '/collaboration?project=20000000-0000-4000-8000-000000000001&document=30000000-0000-4000-8000-000000000001',
        icon: 'document',
        label: '产品设计',
      },
      {
        href: '/collaboration?project=20000000-0000-4000-8000-000000000001&document=30000000-0000-4000-8000-000000000002',
        icon: 'document',
        label: '交互规范',
      },
      { icon: 'document', label: '面包屑' },
    ]);
  });
});
