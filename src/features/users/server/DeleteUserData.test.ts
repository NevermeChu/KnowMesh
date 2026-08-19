import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { starredDocumentsSchema } from '@/models/Schema';
import { deleteUserData } from './DeleteUserData';

const state = vi.hoisted(() => {
  const deleteWhere = vi.fn<(condition: unknown) => Promise<unknown[]>>();
  const remove = vi.fn<(table: unknown) => { where: typeof deleteWhere }>(() => ({
    where: deleteWhere,
  }));
  const updateWhere = vi.fn<(condition: unknown) => Promise<unknown[]>>();
  const updateSet = vi.fn<(values: unknown) => { where: typeof updateWhere }>(() => ({
    where: updateWhere,
  }));
  const update = vi.fn<(table: unknown) => { set: typeof updateSet }>(() => ({
    set: updateSet,
  }));
  const selectWhere = vi.fn<(condition: unknown) => Promise<unknown[]>>();
  const selectJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof selectWhere }>(
    () => ({ where: selectWhere }),
  );
  const selectFrom = vi.fn<(table: unknown) => { innerJoin: typeof selectJoin }>(() => ({
    innerJoin: selectJoin,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));
  const removeWorkspaceForUser = vi.fn<() => Promise<'deleted' | 'left'>>();

  return {
    deleteWhere,
    remove,
    removeWorkspaceForUser,
    select,
    selectFrom,
    selectJoin,
    selectWhere,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial removal mock isolates workspace cascading.
vi.mock('@/features/permissions/server/ResourceRemoval', () => ({
  removeWorkspaceForUser: state.removeWorkspaceForUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate deletion and updates.
vi.mock('@/libs/DB', () => ({
  db: { delete: state.remove, select: state.select, update: state.update },
}));

describe(deleteUserData, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.deleteWhere.mockResolvedValue([]);
    state.updateWhere.mockResolvedValue([]);
    state.selectWhere.mockResolvedValue([]);
    state.removeWorkspaceForUser.mockResolvedValue('deleted');
  });

  it('deletes starred documents during account cleanup', async () => {
    await deleteUserData(db, 'user_1');

    expect(state.remove).toHaveBeenCalledWith(starredDocumentsSchema);
  });
});
