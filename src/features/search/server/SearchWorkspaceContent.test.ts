import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWorkspaceContent } from './SearchWorkspaceContent';

vi.mock(import('server-only'), () => ({}));

const state = vi.hoisted(() => {
  const row = {
    content: {
      content: [
        {
          content: [{ text: '这是一篇关于团队知识库方案设计的文档。', type: 'text' }],
          type: 'paragraph',
        },
      ],
      type: 'doc',
    },
    documentId: '01987654-3210-7000-8000-000000000002',
    projectId: '01987654-3210-7000-8000-000000000001',
    projectName: '产品知识库',
    title: '方案设计',
    updatedAt: new Date('2026-08-01T08:00:00.000Z'),
    workspaceId: '01987654-3210-7000-8000-000000000010',
    workspaceKind: 'personal' as const,
    workspaceName: '个人空间',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const limit = vi.fn<(count: number) => Promise<(typeof row)[]>>(async () => {
    await Promise.resolve();
    return [row];
  });
  const orderBy = vi.fn<(...columns: unknown[]) => { limit: typeof limit }>(() => ({ limit }));
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const chain: {
    innerJoin: (table: unknown, condition: unknown) => typeof chain;
    where: typeof where;
  } = {
    innerJoin: vi.fn<(table: unknown, condition: unknown) => typeof chain>(() => chain),
    where,
  };
  const from = vi.fn<(table: unknown) => typeof chain>(() => chain);
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  const and = vi.fn<(...conditions: unknown[]) => unknown[]>((...conditions) => conditions);
  const desc = vi.fn<(column: unknown) => unknown>((column) => column);
  const eq = vi.fn<
    (column: unknown, value: unknown) => { column: unknown; operation: string; value: unknown }
  >((column, value) => ({ column, operation: 'eq', value }));
  const ilike = vi.fn<
    (column: unknown, pattern: unknown) => { column: unknown; operation: string; pattern: unknown }
  >((column, pattern) => ({ column, operation: 'ilike', pattern }));
  const or = vi.fn<(...conditions: unknown[]) => unknown[]>((...conditions) => conditions);
  const sql = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => unknown>(
    (strings, ...values) => ({ strings, values }),
  );

  return { and, chain, desc, eq, ilike, or, protect, select, sql };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Query operators are inspected as test values.
vi.mock('drizzle-orm', () => ({
  and: state.and,
  desc: state.desc,
  eq: state.eq,
  ilike: state.ilike,
  or: state.or,
  sql: state.sql,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Database mock.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Schema mocks.
vi.mock('@/models/Schema', () => ({
  documentsSchema: {
    content: 'documents.content',
    id: 'documents.id',
    projectId: 'documents.projectId',
    title: 'documents.title',
    updatedAt: 'documents.updatedAt',
  },
  projectMembersSchema: {
    projectId: 'project_members.projectId',
    userId: 'project_members.userId',
  },
  projectsSchema: { id: 'projects.id', name: 'projects.name', workspaceId: 'projects.workspaceId' },
  workspacesSchema: {
    id: 'workspaces.id',
    kind: 'workspaces.kind',
    name: 'workspaces.name',
  },
}));

describe('search workspace content server query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_searcher' });
  });

  it('returns empty array when query is blank', async () => {
    await expect(searchWorkspaceContent({ query: '   ' })).resolves.toStrictEqual([]);
    expect(state.select).not.toHaveBeenCalled();
  });

  it('searches across accessible projects and extracts snippets', async () => {
    const results = await searchWorkspaceContent({ query: '方案设计' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      documentId: '01987654-3210-7000-8000-000000000002',
      projectName: '产品知识库',
      snippet: expect.stringContaining('方案设计'),
      title: '方案设计',
      workspaceKind: 'personal',
    });
    expect(state.eq).toHaveBeenCalledWith('project_members.userId', 'user_searcher');
    expect(state.chain.innerJoin).toHaveBeenCalledTimes(3);
  });

  it('applies workspace kind filters when specified', async () => {
    await searchWorkspaceContent({ filter: 'team', query: '方案' });
    expect(state.eq).toHaveBeenCalledWith('workspaces.kind', 'team');

    await searchWorkspaceContent({ filter: 'personal', query: '方案' });
    expect(state.eq).toHaveBeenCalledWith('workspaces.kind', 'personal');
  });
});
