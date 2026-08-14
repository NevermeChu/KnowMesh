import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  documentsSchema,
  notificationsSchema,
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectMembersSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
} from '@/models/Schema';
import { DELETED_USER_ID, deleteUserData } from './DeleteUserData';

/* oxlint-disable promise/prefer-await-to-callbacks -- Fluent Drizzle test doubles intentionally model heterogeneous query builders. */

const state = vi.hoisted(() => {
  const deleteWhere = vi.fn<(condition: unknown) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  const deleteFrom = vi.fn<(table: unknown) => { where: typeof deleteWhere }>(() => ({
    where: deleteWhere,
  }));
  const updateWhere = vi.fn<(condition: unknown) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  const updateSet = vi.fn<(values: unknown) => { where: typeof updateWhere }>(() => ({
    where: updateWhere,
  }));
  const update = vi.fn<(table: unknown) => { set: typeof updateSet }>(() => ({ set: updateSet }));
  const workspaceWhere =
    vi.fn<(condition: unknown) => Promise<{ id: string; ownerId: string }[]>>();
  const workspaceJoin = vi.fn<
    (table: unknown, condition: unknown) => { where: typeof workspaceWhere }
  >(() => ({ where: workspaceWhere }));
  const workspaceFrom = vi.fn<(table: unknown) => { innerJoin: typeof workspaceJoin }>(() => ({
    innerJoin: workspaceJoin,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof workspaceFrom }>(() => ({
    from: workspaceFrom,
  }));
  const removeWorkspaceForUser = vi.fn<() => Promise<'deleted' | 'left'>>();
  const transaction = vi.fn<
    (
      callback: (transaction: {
        delete: typeof deleteFrom;
        select: typeof select;
        update: typeof update;
      }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ delete: deleteFrom, select, update }));

  return {
    deleteFrom,
    removeWorkspaceForUser,
    transaction,
    update,
    updateSet,
    workspaceWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Resource removal behavior is covered by its focused tests.
vi.mock('@/features/permissions/server/ResourceRemoval', () => ({
  removeWorkspaceForUser: state.removeWorkspaceForUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- The fluent test double intentionally omits unrelated database methods.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));

describe(deleteUserData, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.workspaceWhere.mockResolvedValue([
      { id: 'workspace_owned', ownerId: 'user_1' },
      { id: 'workspace_shared', ownerId: 'user_owner' },
    ]);
    state.removeWorkspaceForUser.mockResolvedValue('deleted');
  });

  it('deletes owned resources before exiting shared resources', async () => {
    await deleteUserData('user_1');

    expect(state.removeWorkspaceForUser).toHaveBeenNthCalledWith(1, expect.anything(), {
      isOwner: true,
      userId: 'user_1',
      workspaceId: 'workspace_owned',
    });
    expect(state.removeWorkspaceForUser).toHaveBeenNthCalledWith(2, expect.anything(), {
      isOwner: false,
      userId: 'user_1',
      workspaceId: 'workspace_shared',
    });
    expect(state.deleteFrom.mock.calls.map(([table]) => table)).toStrictEqual([
      notificationsSchema,
      projectInvitationsSchema,
      projectAccessRequestsSchema,
      workspaceInvitationsSchema,
      workspaceAccessRequestsSchema,
      projectMembersSchema,
      workspaceMembersSchema,
    ]);
    expect(state.update.mock.calls).toStrictEqual([[notificationsSchema], [documentsSchema]]);
    expect(state.updateSet.mock.calls).toStrictEqual([
      [{ actorUserId: null }],
      [{ createdById: DELETED_USER_ID }],
    ]);
  });
});
