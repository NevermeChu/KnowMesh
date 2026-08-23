/* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions are callback-based. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDocument } from './UpdateDocument';

const state = vi.hoisted(() => {
  const returning = vi.fn<() => Promise<unknown[]>>();
  const where = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const set = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<() => { set: typeof set }>(() => ({ set }));
  const forUpdate = vi.fn<() => Promise<unknown[]>>();
  const selectLimit = vi.fn<() => { for: typeof forUpdate }>(() => ({ for: forUpdate }));
  const selectWhere = vi.fn<() => { limit: typeof selectLimit }>(() => ({ limit: selectLimit }));
  const secondInnerJoin = vi.fn<() => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const firstInnerJoin = vi.fn<() => { innerJoin: typeof secondInnerJoin }>(() => ({
    innerJoin: secondInnerJoin,
  }));
  const from = vi.fn<() => { innerJoin: typeof firstInnerJoin }>(() => ({
    innerJoin: firstInnerJoin,
  }));
  const select = vi.fn<() => { from: typeof from }>(() => ({ from }));
  const transaction = vi.fn<
    (
      callback: (transaction: { select: typeof select; update: typeof update }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ select, update }));
  const authorizeDocument = vi.fn<() => Promise<unknown>>();
  const requireUser = vi.fn<() => Promise<{ id: string }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    authorizeDocument,
    forUpdate,
    requireUser,
    returning,
    revalidatePath,
    set,
    transaction,
    update,
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
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial authorization mock isolates permissions check.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate database update.
vi.mock('@/libs/DB', () => ({
  db: { transaction: state.transaction },
}));

describe(updateDocument, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.authorizeDocument.mockResolvedValue({
      document: { id: '10000000-0000-4000-8000-000000000001', projectId: 'project_1' },
    });
    state.returning.mockResolvedValue([{ id: '10000000-0000-4000-8000-000000000001' }]);
    state.forUpdate.mockResolvedValue([{ workspaceKind: 'personal' }]);
  });

  it('updates document content without revalidating workspace layout', async () => {
    await updateDocument({
      content: { content: [{ type: 'paragraph' }], type: 'doc' },
      documentId: '10000000-0000-4000-8000-000000000001',
    });

    expect(state.update).toHaveBeenCalledOnce();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('updates document title and revalidates workspace layout cache', async () => {
    await updateDocument({
      documentId: '10000000-0000-4000-8000-000000000001',
      title: '新文档标题',
    });

    expect(state.update).toHaveBeenCalledOnce();
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects team document content writes', async () => {
    state.forUpdate.mockResolvedValueOnce([
      {
        workspaceKind: 'team',
      },
    ]);
    await expect(
      updateDocument({
        content: { content: [{ type: 'paragraph' }], type: 'doc' },
        documentId: '10000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toThrow('团队文档正文必须通过协作服务保存');
    expect(state.update).not.toHaveBeenCalled();
  });

  it('updates team document titles', async () => {
    state.forUpdate.mockResolvedValueOnce([{ workspaceKind: 'team' }]);

    await updateDocument({
      documentId: '10000000-0000-4000-8000-000000000001',
      title: 'Team title',
    });

    expect(state.update).toHaveBeenCalledOnce();
  });
});
