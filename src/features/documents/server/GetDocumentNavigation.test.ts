/* oxlint-disable unicorn/no-thenable -- Fluent Drizzle query-builder mock requires a thenable chain. */
/* oxlint-disable promise/prefer-catch -- The mock forwards both resolution and rejection paths. */
/* oxlint-disable typescript/promise-function-async -- Builder methods intentionally return pending promises. */
/* oxlint-disable vitest/prefer-import-in-mock -- Loose fluent database mocks cannot satisfy the production module type. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocumentNavigationChildren, getDocumentNavigationPath } from './GetDocumentNavigation';

const state = vi.hoisted(() => {
  const rows = [] as unknown[][];
  const dequeue = () => Promise.resolve(rows.shift() ?? []);
  const makeChain = () => {
    const chain = {
      from: () => chain,
      groupBy: () => dequeue(),
      limit: () => dequeue(),
      orderBy: () => chain,
      then: (resolve?: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        dequeue().then(resolve, reject),
      where: () => chain,
    };
    return chain;
  };
  const select = vi.fn<() => ReturnType<typeof makeChain>>(makeChain);
  const authorizeProject = vi.fn<() => Promise<unknown>>();
  const requireUser = vi.fn<() => Promise<{ id: string }>>();

  return { authorizeProject, requireUser, rows, select };
});

vi.mock('@/features/auth/server/CurrentUser', () => ({ requireUser: state.requireUser }));
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));

describe('document navigation queries', () => {
  const projectId = '10000000-0000-4000-8000-000000000001';
  const rootId = '20000000-0000-4000-8000-000000000002';
  const siblingId = '30000000-0000-4000-8000-000000000003';
  const overflowId = '40000000-0000-4000-8000-000000000004';

  beforeEach(() => {
    vi.clearAllMocks();
    state.rows.length = 0;
    state.requireUser.mockResolvedValue({ id: 'user-1' });
    state.authorizeProject.mockResolvedValue({ project: { id: projectId } });
  });

  it('returns bounded children with stable next cursor', async () => {
    state.rows.push(
      [
        { id: rootId, parentId: null, projectId, sortOrder: 1000, title: 'A' },
        { id: siblingId, parentId: null, projectId, sortOrder: 1000, title: 'B' },
        { id: overflowId, parentId: null, projectId, sortOrder: 2000, title: 'C' },
      ],
      [{ parentId: rootId }],
    );

    const page = await getDocumentNavigationChildren({
      limit: 2,
      parentId: null,
      projectId,
    });

    expect(page).toStrictEqual({
      items: [
        {
          hasChildren: true,
          id: rootId,
          parentId: null,
          projectId,
          sortOrder: 1000,
          title: 'A',
        },
        {
          hasChildren: false,
          id: siblingId,
          parentId: null,
          projectId,
          sortOrder: 1000,
          title: 'B',
        },
      ],
      nextCursor: { id: siblingId, sortOrder: 1000 },
    });
    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'project.structure.read',
      projectId,
      userId: 'user-1',
    });
  });

  it('rejects parent outside project boundary', async () => {
    state.rows.push([]);

    await expect(
      getDocumentNavigationChildren({ limit: 20, parentId: rootId, projectId }),
    ).rejects.toThrow('指定的导航父文档不存在或不属于当前项目');
  });

  it('returns bounded root-to-document path', async () => {
    state.rows.push(
      [{ id: siblingId, parentId: rootId, projectId, sortOrder: 2000, title: 'Child' }],
      [{ id: rootId, parentId: null, projectId, sortOrder: 1000, title: 'Root' }],
      [],
    );

    await expect(
      getDocumentNavigationPath({ documentId: siblingId, projectId }),
    ).resolves.toStrictEqual([
      {
        hasChildren: true,
        id: rootId,
        parentId: null,
        projectId,
        sortOrder: 1000,
        title: 'Root',
      },
      {
        hasChildren: false,
        id: siblingId,
        parentId: rootId,
        projectId,
        sortOrder: 2000,
        title: 'Child',
      },
    ]);
  });

  it('rejects cyclic ancestor path', async () => {
    state.rows.push([{ id: rootId, parentId: rootId, projectId, sortOrder: 1000, title: 'Cycle' }]);

    await expect(getDocumentNavigationPath({ documentId: rootId, projectId })).rejects.toThrow(
      '文档导航层级存在循环或超过最大深度',
    );
  });
});
