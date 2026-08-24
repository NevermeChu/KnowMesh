import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWorkspaceContent } from './SearchWorkspaceContent';

const state = vi.hoisted(() => {
  const offset = vi.fn<() => Promise<unknown[]>>();
  const limit = vi.fn<() => { offset: typeof offset }>(() => ({ offset }));
  const orderBy = vi.fn<() => { limit: typeof limit }>(() => ({ limit }));
  const countWhere = vi.fn<() => Promise<unknown[]>>();
  const dataWhere = vi.fn<() => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  let selectCallCount = 0;

  const selectJoin3 = vi.fn<() => { where: typeof dataWhere | typeof countWhere }>(() => {
    if (selectCallCount === 1) {
      return { where: countWhere };
    }
    return { where: dataWhere };
  });
  const selectJoin2 = vi.fn<() => { innerJoin: typeof selectJoin3 }>(() => ({
    innerJoin: selectJoin3,
  }));
  const selectJoin1 = vi.fn<() => { innerJoin: typeof selectJoin2 }>(() => ({
    innerJoin: selectJoin2,
  }));
  const selectFrom = vi.fn<() => { innerJoin: typeof selectJoin1 }>(() => ({
    innerJoin: selectJoin1,
  }));
  const select = vi.fn<() => { from: typeof selectFrom }>(() => {
    selectCallCount += 1;
    return { from: selectFrom };
  });
  const requireUser = vi.fn<() => Promise<{ id: string }>>();
  const resetSelectCallCount = () => {
    selectCallCount = 0;
  };

  return {
    countWhere,
    dataWhere,
    limit,
    offset,
    orderBy,
    requireUser,
    resetSelectCallCount,
    select,
    selectFrom,
    selectJoin1,
    selectJoin2,
    selectJoin3,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates user identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({
  requireUser: state.requireUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate search query construction.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe(searchWorkspaceContent, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resetSelectCallCount();
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.countWhere.mockResolvedValue([{ count: 0 }]);
    state.offset.mockResolvedValue([]);
  });

  it('searches documents with pagination and returns mapped results with snippets', async () => {
    state.countWhere.mockResolvedValueOnce([{ count: 25 }]);
    state.offset.mockResolvedValueOnce([
      {
        documentId: 'doc_2',
        projectId: 'project_1',
        projectName: '项目一',
        searchText: '这里特别提到了关于 paragraph 的段落写作排版规范。',
        title: '文档二',
        updatedAt: new Date('2026-08-02'),
        workspaceId: 'workspace_1',
        workspaceKind: 'team' as const,
        workspaceName: '工作区一',
      },
    ]);

    const results = await searchWorkspaceContent({
      page: 1,
      pageSize: 20,
      query: 'paragraph',
    });

    expect(results).toMatchObject({
      hasMore: true,
      page: 1,
      pageSize: 20,
      totalCount: 25,
      totalPages: 2,
    });
    expect(results.items).toHaveLength(1);
    expect(results.items[0]).toMatchObject({
      documentId: 'doc_2',
      snippet: expect.stringContaining('paragraph'),
      title: '文档二',
    });
    expect(state.select).toHaveBeenCalledTimes(2);
  });

  it('returns empty result object when query is whitespace', async () => {
    const results = await searchWorkspaceContent({ query: '   ' });
    expect(results).toStrictEqual({
      hasMore: false,
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
    });
    expect(state.select).not.toHaveBeenCalled();
  });
});
