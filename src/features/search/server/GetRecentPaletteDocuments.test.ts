import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecentPaletteDocuments } from './GetRecentPaletteDocuments';

const state = vi.hoisted(() => {
  const selectWhere = vi.fn<(condition: unknown) => Promise<unknown[]>>();
  const selectJoin3 = vi.fn<(table: unknown, condition: unknown) => { where: typeof selectWhere }>(
    () => ({ where: selectWhere }),
  );
  const selectJoin2 = vi.fn<
    (table: unknown, condition: unknown) => { innerJoin: typeof selectJoin3 }
  >(() => ({
    innerJoin: selectJoin3,
  }));
  const selectJoin1 = vi.fn<
    (table: unknown, condition: unknown) => { innerJoin: typeof selectJoin2 }
  >(() => ({
    innerJoin: selectJoin2,
  }));
  const selectFrom = vi.fn<(table: unknown) => { innerJoin: typeof selectJoin1 }>(() => ({
    innerJoin: selectJoin1,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));
  const requireUser = vi.fn<() => Promise<{ id: string }>>();

  return {
    requireUser,
    select,
    selectFrom,
    selectJoin1,
    selectJoin2,
    selectJoin3,
    selectWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates user identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({
  requireUser: state.requireUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate permissions join and ordering.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe(getRecentPaletteDocuments, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.selectWhere.mockResolvedValue([]);
  });

  it('returns accessible documents in requested order and filters inaccessible documents', async () => {
    const doc1Id = '10000000-0000-4000-8000-000000000001';
    const doc2Id = '10000000-0000-4000-8000-000000000002';
    const inaccessibleDocId = '10000000-0000-4000-8000-000000000003';

    state.selectWhere.mockResolvedValueOnce([
      {
        documentId: doc2Id,
        projectId: 'project_2',
        projectName: 'Project 2',
        title: 'Doc 2',
        updatedAt: new Date('2026-08-01'),
        workspaceId: 'workspace_1',
        workspaceKind: 'team' as const,
        workspaceName: 'Workspace 1',
      },
      {
        documentId: doc1Id,
        projectId: 'project_1',
        projectName: 'Project 1',
        title: 'Doc 1',
        updatedAt: new Date('2026-08-02'),
        workspaceId: 'workspace_1',
        workspaceKind: 'personal' as const,
        workspaceName: 'Workspace 1',
      },
    ]);

    const result = await getRecentPaletteDocuments({
      documentIds: [doc1Id, inaccessibleDocId, doc2Id],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.documentId).toBe(doc1Id);
    expect(result[0]?.title).toBe('Doc 1');
    expect(result[1]?.documentId).toBe(doc2Id);
    expect(result[1]?.title).toBe('Doc 2');
  });
});
