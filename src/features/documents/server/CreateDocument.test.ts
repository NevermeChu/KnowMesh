/* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions are callback-based. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { requireProjectPermissionInTransaction as requireProjectPermissionInTransactionFunction } from '@/features/permissions/server/RevalidateProjectPermission';
import { createDocument } from './CreateDocument';

const state = vi.hoisted(() => {
  const returning = vi.fn<() => Promise<unknown[]>>();
  const values = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const insert = vi.fn<() => { values: typeof values }>(() => ({ values }));
  const limit = vi.fn<() => Promise<unknown[]>>();
  const orderBy = vi.fn<() => { limit: typeof limit }>(() => ({ limit }));
  const where = vi.fn<() => { limit: typeof limit; orderBy: typeof orderBy }>(() => ({
    limit,
    orderBy,
  }));
  const from = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const select = vi.fn<() => { from: typeof from }>(() => ({ from }));
  const authorizeProject = vi.fn<() => Promise<unknown>>();
  const requireProjectPermissionInTransaction =
    vi.fn<typeof requireProjectPermissionInTransactionFunction>();
  const requireUser = vi.fn<() => Promise<{ id: string }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const transaction = vi.fn<
    (
      callback: (transaction: { insert: typeof insert; select: typeof select }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ insert, select }));

  return {
    authorizeProject,
    from,
    insert,
    limit,
    orderBy,
    requireProjectPermissionInTransaction,
    requireUser,
    returning,
    revalidatePath,
    select,
    transaction,
    values,
    where,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial next/cache mock isolates layout revalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates user identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({
  requireUser: state.requireUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial authorization mock isolates project permissions check.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
vi.mock(import('@/features/permissions/server/RevalidateProjectPermission'), () => ({
  requireProjectPermissionInTransaction: state.requireProjectPermissionInTransaction,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate database queries.
vi.mock('@/libs/DB', () => ({
  db: {
    transaction: state.transaction,
  },
}));

describe(createDocument, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.authorizeProject.mockResolvedValue({
      project: { id: '01987654-3210-7000-8000-000000000001' },
    });
    state.limit.mockResolvedValue([]);
    state.returning.mockResolvedValue([
      {
        id: '10000000-0000-4000-8000-000000000001',
        kind: 'rich-text',
        parentId: null,
        projectId: '01987654-3210-7000-8000-000000000001',
        sortOrder: 1000,
        title: '新文档',
      },
    ]);
  });

  it('creates root document and revalidates workspace layout', async () => {
    const document = await createDocument({
      projectId: '01987654-3210-7000-8000-000000000001',
      title: '新文档',
    });

    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'document.create',
      projectId: '01987654-3210-7000-8000-000000000001',
      userId: 'user_1',
    });
    expect(state.insert).toHaveBeenCalledOnce();
    expect(state.requireProjectPermissionInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'document.create',
        projectId: '01987654-3210-7000-8000-000000000001',
        userId: 'user_1',
      }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
    expect(document.id).toBe('10000000-0000-4000-8000-000000000001');
  });

  it('rejects creation if parent document does not exist in the project', async () => {
    state.limit.mockResolvedValueOnce([]);

    await expect(
      createDocument({
        parentId: '01987654-3210-7000-8000-000000000099',
        projectId: '01987654-3210-7000-8000-000000000001',
        title: '子文档',
      }),
    ).rejects.toThrow('指定的父文档不存在或不属于当前项目');

    expect(state.insert).not.toHaveBeenCalled();
  });

  it('creates whiteboard state in document transaction', async () => {
    state.returning.mockResolvedValueOnce([
      {
        id: '10000000-0000-4000-8000-000000000002',
        kind: 'whiteboard',
        parentId: null,
        projectId: '01987654-3210-7000-8000-000000000001',
        sortOrder: 1000,
        title: '白板',
      },
    ]);

    const document = await createDocument({
      kind: 'whiteboard',
      projectId: '01987654-3210-7000-8000-000000000001',
      title: '白板',
    });

    expect(state.insert).toHaveBeenCalledTimes(2);
    expect(document.kind).toBe('whiteboard');
  });
});
