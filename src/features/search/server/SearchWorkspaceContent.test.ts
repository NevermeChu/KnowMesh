import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWorkspaceContent } from './SearchWorkspaceContent';

const state = vi.hoisted(() => {
  const limit = vi.fn<() => Promise<unknown[]>>();
  const orderBy = vi.fn<() => { limit: typeof limit }>(() => ({ limit }));
  const where = vi.fn<() => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const selectJoin3 = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const selectJoin2 = vi.fn<() => { innerJoin: typeof selectJoin3 }>(() => ({
    innerJoin: selectJoin3,
  }));
  const selectJoin1 = vi.fn<() => { innerJoin: typeof selectJoin2 }>(() => ({
    innerJoin: selectJoin2,
  }));
  const selectFrom = vi.fn<() => { innerJoin: typeof selectJoin1 }>(() => ({
    innerJoin: selectJoin1,
  }));
  const select = vi.fn<() => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));
  const requireUser = vi.fn<() => Promise<{ id: string }>>();

  return {
    limit,
    orderBy,
    requireUser,
    select,
    selectFrom,
    selectJoin1,
    selectJoin2,
    selectJoin3,
    where,
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
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.limit.mockResolvedValue([]);
  });

  it('searches documents using indexed searchText and returns mapped results with snippets', async () => {
    state.limit.mockResolvedValueOnce([
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

    const results = await searchWorkspaceContent({ query: 'paragraph' });

    expect(results).toHaveLength(1);
    expect(results[0]?.documentId).toBe('doc_2');
    expect(results[0]?.snippet).toContain('paragraph');
    expect(results[0]?.title).toBe('文档二');
    expect(state.select).toHaveBeenCalledOnce();
  });

  it('returns empty array when query is whitespace', async () => {
    const results = await searchWorkspaceContent({ query: '   ' });
    expect(results).toStrictEqual([]);
    expect(state.select).not.toHaveBeenCalled();
  });
});
