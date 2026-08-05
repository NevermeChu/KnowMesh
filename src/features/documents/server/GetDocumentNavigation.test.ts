import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentsSchema, projectMembersSchema } from '@/models/Schema';
import { getDocumentNavigation } from './GetDocumentNavigation';

type DocumentNavigationRecord = {
  createdAt: Date;
  id: string;
  projectId: string;
  title: string;
  updatedAt: Date;
};

const state = vi.hoisted(() => {
  const documents: DocumentNavigationRecord[] = [
    {
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      id: '01987654-3210-7000-8000-000000000002',
      projectId: '01987654-3210-7000-8000-000000000001',
      title: '产品方案',
      updatedAt: new Date('2026-08-04T01:00:00.000Z'),
    },
  ];
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const eq = vi.fn<(left: unknown, right: unknown) => object>((left, right) => ({
    left,
    operator: 'eq',
    right,
  }));
  const desc = vi.fn<(column: unknown) => object>((column) => ({ column, operator: 'desc' }));
  const orderBy = vi.fn<(order: unknown) => Promise<DocumentNavigationRecord[]>>(async () => {
    await Promise.resolve();
    return documents;
  });
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({ innerJoin }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return { desc, documents, eq, innerJoin, protect, select };
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
    await expect(getDocumentNavigation()).resolves.toStrictEqual(state.documents);

    expect(state.eq).toHaveBeenCalledWith(projectMembersSchema.userId, 'user_1');
    expect(state.innerJoin).toHaveBeenCalledWith(projectMembersSchema, expect.anything());
    expect(state.desc).toHaveBeenCalledWith(documentsSchema.updatedAt);
  });
});
