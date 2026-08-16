import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecentDocuments } from './GetRecentDocuments';

vi.mock(import('server-only'), () => ({}));

const state = vi.hoisted(() => {
  const document = {
    documentId: '01987654-3210-7000-8000-000000000002',
    projectId: '01987654-3210-7000-8000-000000000001',
    projectName: '产品知识库',
    title: '产品方案',
    updatedAt: new Date('2026-08-01T08:00:00.000Z'),
    workspaceKind: 'personal' as const,
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const limit = vi.fn<(count: number) => Promise<(typeof document)[]>>(async () => {
    await Promise.resolve();
    return [document];
  });
  const orderBy = vi.fn<(column: unknown) => { limit: typeof limit }>(() => ({ limit }));
  const chain: {
    innerJoin: (
      table: unknown,
      condition: unknown,
    ) => { innerJoin: typeof chain.innerJoin } & {
      orderBy: typeof orderBy;
    };
  } & { orderBy: typeof orderBy } = {
    innerJoin: vi.fn<(table: unknown, condition: unknown) => typeof chain>(() => chain),
    orderBy,
  };
  const from = vi.fn<(table: unknown) => typeof chain>(() => chain);
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));
  const and = vi.fn<(...conditions: unknown[]) => unknown[]>((...conditions) => conditions);
  const desc = vi.fn<(column: unknown) => unknown>((column) => column);
  const eq = vi.fn<
    (column: unknown, value: unknown) => { column: unknown; operation: string; value: unknown }
  >((column, value) => ({ column, operation: 'eq', value }));

  return { and, chain, desc, eq, protect, select };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Query operators are inspected as test values.
vi.mock('drizzle-orm', () => ({ and: state.and, desc: state.desc, eq: state.eq }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates select behavior.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Column markers make ownership assertions explicit.
vi.mock('@/models/Schema', () => ({
  documentsSchema: {
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
  workspacesSchema: { id: 'workspaces.id', kind: 'workspaces.kind' },
}));

describe(getRecentDocuments, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_reader' });
  });

  it('scopes documents to direct project membership of the authenticated user', async () => {
    await expect(getRecentDocuments()).resolves.toHaveLength(1);

    expect(state.eq).toHaveBeenCalledWith('project_members.userId', 'user_reader');
    expect(state.chain.innerJoin).toHaveBeenCalledTimes(3);
  });
});
