/* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions are callback-based. */
/* oxlint-disable unicorn/no-thenable -- Fluent Drizzle query-builder mock requires a thenable chain. */
/* oxlint-disable promise/prefer-catch -- The mock forwards both resolution and rejection paths. */
/* oxlint-disable typescript/promise-function-async -- Builder methods intentionally return pending promises. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveDocument } from './MoveDocument';

const state = vi.hoisted(() => {
  const returning = vi.fn<() => Promise<unknown[]>>();
  const updateWhere = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const set = vi.fn<() => { where: typeof updateWhere }>(() => ({ where: updateWhere }));
  const update = vi.fn<() => { set: typeof set }>(() => ({ set }));

  const limit = vi.fn<() => Promise<unknown[]>>();
  const orderBy = vi.fn<() => { limit: typeof limit }>(() => ({ limit }));
  const where = vi.fn<() => { limit: typeof limit; orderBy: typeof orderBy }>(() => ({
    limit,
    orderBy,
  }));
  const from = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const select = vi.fn<() => { from: typeof from }>(() => ({ from }));

  const txQueue = { rows: [] as unknown[][] };
  const dequeue = () => Promise.resolve(txQueue.rows.shift() ?? []);
  const makeTxChain = () => {
    const chain = {
      for: () => dequeue(),
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      then: (resolve?: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        dequeue().then(resolve, reject),
      where: () => chain,
    };
    return chain;
  };
  const txSelect = vi.fn<() => ReturnType<typeof makeTxChain>>(makeTxChain);

  const txDeleteWhere = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([]));
  const txDelete = vi.fn<() => { where: typeof txDeleteWhere }>(() => ({
    where: txDeleteWhere,
  }));

  const transaction = vi.fn<
    (
      callback: (transaction: {
        delete: typeof txDelete;
        select: typeof txSelect;
        update: typeof update;
      }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ delete: txDelete, select: txSelect, update }));

  const authorizeDocument = vi.fn<() => Promise<unknown>>();
  const authorizeProject = vi.fn<() => Promise<unknown>>();
  const requireUser = vi.fn<() => Promise<{ id: string }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    authorizeDocument,
    authorizeProject,
    from,
    limit,
    orderBy,
    requireUser,
    returning,
    revalidatePath,
    select,
    set,
    transaction,
    txDelete,
    txQueue,
    txSelect,
    update,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial next/cache mock isolates layout revalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates user identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({
  requireUser: state.requireUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial authorization mock isolates document permissions check.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial authorization mock isolates project permissions check.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate database updates.
vi.mock('@/libs/DB', () => ({
  db: {
    select: state.select,
    transaction: state.transaction,
  },
}));

describe(moveDocument, () => {
  const docId = '10000000-0000-4000-8000-000000000001';
  const parentId = '20000000-0000-4000-8000-000000000002';
  const projectId = '30000000-0000-4000-8000-000000000003';
  const targetProjectId = '40000000-0000-4000-8000-000000000004';

  beforeEach(() => {
    vi.clearAllMocks();
    state.txQueue.rows = [];
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.authorizeDocument.mockResolvedValue({
      document: { id: docId, projectId },
      project: { id: projectId, workspaceKind: 'team' },
    });
    state.authorizeProject.mockResolvedValue({
      project: { id: targetProjectId, workspaceKind: 'personal' },
    });
    state.limit.mockResolvedValue([]);
    state.returning.mockResolvedValue([
      {
        id: docId,
        parentId,
        projectId,
        sortOrder: 1000,
        title: '移动后的文档',
      },
    ]);
  });

  it('moves document to new parent within same project', async () => {
    state.limit
      .mockResolvedValueOnce([
        {
          id: parentId,
          parentId: null,
          projectId,
        },
      ])
      .mockResolvedValueOnce([]);

    state.txQueue.rows = [
      [{ kind: 'team', name: '源项目', ownerId: 'user_1', workspaceId: 'ws-source' }],
      [{ role: 'owner' }],
      [{ role: 'owner' }],
    ];

    const result = await moveDocument({
      documentId: docId,
      targetParentId: parentId,
      targetProjectId: projectId,
    });

    expect(state.authorizeDocument).toHaveBeenCalledWith({
      documentId: docId,
      permission: 'document.update',
      userId: 'user_1',
    });
    expect(state.authorizeProject).not.toHaveBeenCalled();
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
    expect(result.id).toBe(docId);
  });

  it('rejects moving a document to be its own child', async () => {
    await expect(
      moveDocument({
        documentId: docId,
        targetParentId: docId,
        targetProjectId: projectId,
      }),
    ).rejects.toThrow('不能将文档设置为自身的子文档');

    expect(state.update).not.toHaveBeenCalled();
  });

  it('rejects moving a document into its own descendant', async () => {
    state.limit
      .mockResolvedValueOnce([
        {
          id: parentId,
          parentId: 'descendant_intermediate',
          projectId,
        },
      ])
      .mockResolvedValueOnce([
        {
          parentId: docId, // Ancestor chain leads back to docId!
        },
      ]);

    await expect(
      moveDocument({
        documentId: docId,
        targetParentId: parentId,
        targetProjectId: projectId,
      }),
    ).rejects.toThrow('不能将文档移动到其子文档中');

    expect(state.update).not.toHaveBeenCalled();
  });

  it('authorizes target project and updates descendants when moving across projects', async () => {
    state.limit
      .mockResolvedValueOnce([
        {
          id: parentId,
          parentId: null,
          projectId: targetProjectId,
        },
      ])
      .mockResolvedValueOnce([]);

    state.txQueue.rows = [
      [{ kind: 'team', name: '源项目', ownerId: 'user_1', workspaceId: 'ws-source' }],
      [{ role: 'owner' }],
      [{ role: 'owner' }],
      [{ kind: 'personal', name: '目标项目', ownerId: 'user_1', workspaceId: 'ws-target' }],
      [{ role: 'owner' }],
      [{ role: 'owner' }],
    ];

    await moveDocument({
      documentId: docId,
      targetParentId: parentId,
      targetProjectId,
    });

    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'document.create',
      projectId: targetProjectId,
      userId: 'user_1',
    });
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.txDelete).toHaveBeenCalledOnce();
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});
