import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectDocuments } from './GetProjectDocuments';

const state = vi.hoisted(() => {
  const projectId = '01987654-3210-7000-8000-000000000001';
  const documentId = '01987654-3210-7000-8000-000000000002';
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const documents = [
    {
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      id: documentId,
      title: '产品方案',
      updatedAt: new Date('2026-08-04T01:00:00.000Z'),
    },
  ];
  const selectedContent = [
    {
      content: { content: [{ type: 'paragraph' }], type: 'doc' },
      contentSchemaVersion: 1,
      projectId,
    },
  ];
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const getProjectAuthorization = vi.fn<
    (options: { projectId: string; userId: string }) => Promise<{
      decision: { grants: never[]; isResourceOwner: boolean; permissions: string[] };
      project: {
        id: string;
        kind: 'collaboration' | 'personal';
        name: string;
        workspaceId: string;
      };
    } | null>
  >();
  const listOrderBy = vi.fn<(order: unknown) => Promise<typeof documents>>(async () => {
    await Promise.resolve();
    return documents;
  });
  const listWhere = vi.fn<(condition: unknown) => { orderBy: typeof listOrderBy }>(() => ({
    orderBy: listOrderBy,
  }));
  const contentLimit = vi.fn<(limit: number) => Promise<typeof selectedContent>>(async () => {
    await Promise.resolve();
    return selectedContent;
  });
  const contentWhere = vi.fn<(condition: unknown) => { limit: typeof contentLimit }>(() => ({
    limit: contentLimit,
  }));
  let selectCallCount = 0;
  const from = vi.fn<(table: unknown) => object>(() => {
    selectCallCount += 1;
    return selectCallCount === 1 ? { where: listWhere } : { where: contentWhere };
  });
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return {
    documentId,
    documents,
    getProjectAuthorization,
    projectId,
    protect,
    resetSelectCount: () => {
      selectCallCount = 0;
    },
    select,
    selectedContent,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The marker module has no runtime behavior in unit tests.
vi.mock('server-only', () => ({}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The mock isolates the membership query from document selection.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  getProjectAuthorization: state.getProjectAuthorization,
}));

describe('project document queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resetSelectCount();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.getProjectAuthorization.mockResolvedValue({
      decision: {
        grants: [],
        isResourceOwner: true,
        permissions: ['project.read', 'document.read'],
      },
      project: {
        id: state.projectId,
        kind: 'personal',
        name: '产品知识库',
        workspaceId: state.workspaceId,
      },
    });
  });

  it('returns selected document for project member', async () => {
    await expect(
      getProjectDocuments({
        documentId: state.documentId,
        kind: 'personal',
        projectId: state.projectId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toStrictEqual({
      access: {
        grants: [],
        isResourceOwner: true,
        permissions: ['project.read', 'document.read'],
      },
      documents: state.documents,
      selectedDocument: {
        ...state.documents[0],
        ...state.selectedContent[0],
      },
    });
  });

  it('rejects inaccessible project before document query', async () => {
    state.getProjectAuthorization.mockResolvedValueOnce(null);

    await expect(
      getProjectDocuments({
        kind: 'personal',
        projectId: state.projectId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toBeNull();
    expect(state.select).not.toHaveBeenCalled();
  });

  it('rejects project from another workspace kind', async () => {
    state.getProjectAuthorization.mockResolvedValueOnce({
      decision: { grants: [], isResourceOwner: true, permissions: ['project.read'] },
      project: {
        id: state.projectId,
        kind: 'collaboration',
        name: '产品知识库',
        workspaceId: state.workspaceId,
      },
    });

    await expect(
      getProjectDocuments({
        kind: 'personal',
        projectId: state.projectId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toBeNull();
    expect(state.select).not.toHaveBeenCalled();
  });

  it('rejects project from another workspace', async () => {
    state.getProjectAuthorization.mockResolvedValueOnce({
      decision: { grants: [], isResourceOwner: true, permissions: ['project.read'] },
      project: {
        id: state.projectId,
        kind: 'personal',
        name: '产品知识库',
        workspaceId: '01987654-3210-7000-8000-000000000011',
      },
    });

    await expect(
      getProjectDocuments({
        kind: 'personal',
        projectId: state.projectId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toBeNull();
    expect(state.select).not.toHaveBeenCalled();
  });
});
