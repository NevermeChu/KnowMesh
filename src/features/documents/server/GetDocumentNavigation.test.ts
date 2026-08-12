import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectMembersSchema, projectsSchema, workspaceMembersSchema } from '@/models/Schema';
import { getDocumentNavigation } from './GetDocumentNavigation';

type DocumentNavigationRecord = {
  createdAt: Date;
  id: string;
  kind: 'personal';
  ownerId: string;
  projectId: string;
  projectRole: 'owner';
  title: string;
  updatedAt: Date;
  workspaceRole: 'owner';
};

const state = vi.hoisted(() => {
  const documents: DocumentNavigationRecord[] = [
    {
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      id: '01987654-3210-7000-8000-000000000002',
      kind: 'personal',
      ownerId: 'user_1',
      projectId: '01987654-3210-7000-8000-000000000001',
      projectRole: 'owner',
      title: '产品方案',
      updatedAt: new Date('2026-08-04T01:00:00.000Z'),
      workspaceRole: 'owner',
    },
  ];
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const eq = vi.fn<(left: unknown, right: unknown) => object>((left, right) => ({
    left,
    operator: 'eq',
    right,
  }));
  const and = vi.fn<(...conditions: unknown[]) => object>((...conditions) => ({
    conditions,
    operator: 'and',
  }));
  const desc = vi.fn<(column: unknown) => object>((column) => ({ column, operator: 'desc' }));
  const orderBy = vi.fn<(order: unknown) => Promise<DocumentNavigationRecord[]>>(async () => {
    await Promise.resolve();
    return documents;
  });
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const memberJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const workspaceJoin = vi.fn<
    (table: unknown, condition: unknown) => { leftJoin: typeof memberJoin }
  >(() => ({ leftJoin: memberJoin }));
  const projectJoin = vi.fn<
    (table: unknown, condition: unknown) => { innerJoin: typeof workspaceJoin }
  >(() => ({ innerJoin: workspaceJoin }));
  const from = vi.fn<(table: unknown) => { innerJoin: typeof projectJoin }>(() => ({
    innerJoin: projectJoin,
  }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return { and, desc, documents, eq, memberJoin, projectJoin, protect, select, workspaceJoin };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The marker module has no runtime behavior in unit tests.
vi.mock('server-only', () => ({}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Operator spies verify the generated access predicate.
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal()),
  and: state.and,
  desc: state.desc,
  eq: state.eq,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe('document navigation query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
  });

  it('returns member documents by recent update', async () => {
    const workspaceId = '01987654-3210-7000-8000-000000000010';

    await expect(getDocumentNavigation({ workspaceId })).resolves.toStrictEqual(
      state.documents.map((document) => ({
        createdAt: document.createdAt,
        id: document.id,
        projectId: document.projectId,
        title: document.title,
        updatedAt: document.updatedAt,
      })),
    );

    expect(state.eq).toHaveBeenCalledWith(workspaceMembersSchema.userId, 'user_1');
    expect(state.eq).toHaveBeenCalledWith(projectsSchema.workspaceId, workspaceId);
    expect(state.workspaceJoin).toHaveBeenCalledWith(workspaceMembersSchema, expect.anything());
    expect(state.memberJoin).toHaveBeenCalledWith(projectMembersSchema, expect.anything());
  });
});
