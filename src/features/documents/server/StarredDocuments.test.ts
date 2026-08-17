import { beforeEach, describe, expect, it, vi } from 'vitest';
import { starredDocumentsSchema } from '@/models/Schema';
import {
  getIsDocumentStarred,
  getStarredDocuments,
  toggleStarredDocument,
} from './StarredDocuments';

vi.mock(import('server-only'), () => ({}));

const state = vi.hoisted(() => {
  const document = {
    documentId: '01987654-3210-7000-8000-000000000002',
    projectId: '01987654-3210-7000-8000-000000000001',
    projectName: '产品知识库',
    starredAt: new Date('2026-08-01T08:00:00.000Z'),
    title: '产品方案',
    updatedAt: new Date('2026-08-01T08:00:00.000Z'),
    workspaceKind: 'personal' as const,
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const revalidatePath = vi.fn<(path: string) => void>();
  const authorizeDocument = vi.fn<() => Promise<{ document: { id: string } }>>();

  const orderBy = vi.fn<(column: unknown) => Promise<(typeof document)[]>>(async () => {
    await Promise.resolve();
    return [document];
  });
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const chain: {
    innerJoin: (table: unknown, condition: unknown) => typeof chain;
    where: typeof where;
  } = {
    innerJoin: vi.fn<(table: unknown, condition: unknown) => typeof chain>(() => chain),
    where,
  };
  const from = vi.fn<(table: unknown) => typeof chain>(() => chain);
  const selectLimit = vi.fn<() => Promise<{ documentId: string }[]>>(async () => {
    await Promise.resolve();
    return [];
  });
  const selectWhere = vi.fn<() => { limit: typeof selectLimit }>(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn<() => { where: typeof selectWhere }>(() => ({ where: selectWhere }));
  const select = vi.fn<(selection: unknown) => unknown>((selection) => {
    if (typeof selection === 'object' && selection !== null && 'starredAt' in selection) {
      return { from };
    }
    return { from: selectFrom };
  });

  const insertValues = vi.fn<() => Promise<void>>(async () => {
    await Promise.resolve();
  });
  const insert = vi.fn<() => { values: typeof insertValues }>(() => ({ values: insertValues }));

  const deleteWhere = vi.fn<() => Promise<void>>(async () => {
    await Promise.resolve();
  });
  const deleteOp = vi.fn<() => { where: typeof deleteWhere }>(() => ({ where: deleteWhere }));

  const and = vi.fn<(...conditions: unknown[]) => unknown[]>((...conditions) => conditions);
  const desc = vi.fn<(column: unknown) => unknown>((column) => column);
  const eq = vi.fn<
    (column: unknown, value: unknown) => { column: unknown; operation: string; value: unknown }
  >((column, value) => ({ column, operation: 'eq', value }));

  return {
    and,
    authorizeDocument,
    chain,
    deleteOp,
    deleteWhere,
    desc,
    document,
    eq,
    insert,
    insertValues,
    protect,
    revalidatePath,
    select,
    selectLimit,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Query operators are inspected as test values.
vi.mock('drizzle-orm', () => ({ and: state.and, desc: state.desc, eq: state.eq }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates DB calls.
vi.mock('@/libs/DB', () => ({
  db: {
    delete: state.deleteOp,
    insert: state.insert,
    select: state.select,
  },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Cache invalidation mock.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested separately.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Model schemas mock.
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
  starredDocumentsSchema: {
    createdAt: 'starred_documents.createdAt',
    documentId: 'starred_documents.documentId',
    userId: 'starred_documents.userId',
  },
  workspacesSchema: { id: 'workspaces.id', kind: 'workspaces.kind' },
}));

describe('starred documents actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_star_tester' });
    state.authorizeDocument.mockResolvedValue({ document: { id: state.document.documentId } });
    state.selectLimit.mockResolvedValue([]);
  });

  it('reads all starred documents with project and workspace info', async () => {
    await expect(getStarredDocuments()).resolves.toHaveLength(1);
    expect(state.chain.innerJoin).toHaveBeenCalledTimes(4);
  });

  it('checks whether document is starred', async () => {
    state.selectLimit.mockResolvedValueOnce([{ documentId: state.document.documentId }]);
    await expect(
      getIsDocumentStarred({ documentId: state.document.documentId }),
    ).resolves.toBeTruthy();

    state.selectLimit.mockResolvedValueOnce([]);
    await expect(
      getIsDocumentStarred({ documentId: state.document.documentId }),
    ).resolves.toBeFalsy();
  });

  it('stars unstarred document and revalidates path', async () => {
    state.selectLimit.mockResolvedValueOnce([]);

    const result = await toggleStarredDocument({ documentId: state.document.documentId });

    expect(result).toStrictEqual({ isStarred: true });
    expect(state.insert).toHaveBeenCalledWith(starredDocumentsSchema);
    expect(state.revalidatePath).toHaveBeenCalledWith('/starred');
  });

  it('unstars starred document and revalidates path', async () => {
    state.selectLimit.mockResolvedValueOnce([{ documentId: state.document.documentId }]);

    const result = await toggleStarredDocument({ documentId: state.document.documentId });

    expect(result).toStrictEqual({ isStarred: false });
    expect(state.deleteOp).toHaveBeenCalledWith(starredDocumentsSchema);
    expect(state.revalidatePath).toHaveBeenCalledWith('/starred');
  });

  it('rejects toggling star for unauthorized document', async () => {
    state.authorizeDocument.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(toggleStarredDocument({ documentId: state.document.documentId })).rejects.toThrow(
      '没有权限执行该操作',
    );
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.deleteOp).not.toHaveBeenCalled();
  });
});
