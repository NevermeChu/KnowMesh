import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import {
  notificationsSchema,
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectMembersSchema,
  projectsSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';
import { removeProjectForUser, removeWorkspaceForUser } from './ResourceRemoval';

const state = vi.hoisted(() => {
  const returning = vi.fn<() => Promise<unknown[]>>();
  const deleteWhere = vi.fn<(condition: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
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
  const selectFrom = vi.fn<
    (table: unknown) => { innerJoin: typeof selectJoin; where: typeof selectWhere }
  >(() => ({
    innerJoin: selectJoin,
    where: selectWhere,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));

  return {
    deleteWhere,
    remove,
    returning,
    select,
    selectFrom,
    selectWhere,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate removal ordering and branching.
vi.mock('@/libs/DB', () => ({
  db: { delete: state.remove, select: state.select, update: state.update },
}));

describe('resource removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectWhere.mockResolvedValue([]);
    state.updateWhere.mockResolvedValue([]);
  });

  it('deletes project for owner and nullifies notification targets', async () => {
    state.returning.mockResolvedValueOnce([{ id: 'project_1' }]);

    await expect(
      removeProjectForUser(db, { isOwner: true, projectId: 'project_1', userId: 'user_1' }),
    ).resolves.toBe('deleted');

    expect(state.update).toHaveBeenCalledWith(notificationsSchema);
    expect(state.updateSet).toHaveBeenCalledWith({ targetId: null, targetKind: null });
    expect(state.remove).toHaveBeenCalledWith(projectsSchema);
  });

  it('removes only project relationship for member', async () => {
    state.returning.mockResolvedValueOnce([{ userId: 'user_1' }]);

    await expect(
      removeProjectForUser(db, { isOwner: false, projectId: 'project_1', userId: 'user_1' }),
    ).resolves.toBe('left');

    expect(state.remove).toHaveBeenCalledWith(projectAccessRequestsSchema);
    expect(state.remove).toHaveBeenCalledWith(projectInvitationsSchema);
    expect(state.remove).toHaveBeenCalledWith(projectMembersSchema);
  });

  it('deletes workspace for owner and nullifies notification targets', async () => {
    state.selectWhere.mockResolvedValueOnce([{ id: 'project_1' }]);
    state.returning.mockResolvedValueOnce([{ id: 'workspace_1' }]);

    await expect(
      removeWorkspaceForUser(db, {
        isOwner: true,
        userId: 'user_1',
        workspaceId: 'workspace_1',
      }),
    ).resolves.toBe('deleted');

    expect(state.update).toHaveBeenCalledWith(notificationsSchema);
    expect(state.updateSet).toHaveBeenCalledWith({ targetId: null, targetKind: null });
    expect(state.remove.mock.calls.map(([table]) => table)).toStrictEqual([workspacesSchema]);
  });

  it('deletes owned projects and exits other projects before leaving workspace', async () => {
    state.selectWhere.mockResolvedValueOnce([
      { id: 'project_owned', ownerId: 'user_1' },
      { id: 'project_shared', ownerId: 'user_owner' },
    ]);
    state.returning
      .mockResolvedValueOnce([{ id: 'project_owned' }])
      .mockResolvedValueOnce([{ userId: 'user_1' }])
      .mockResolvedValueOnce([{ userId: 'user_1' }]);

    await expect(
      removeWorkspaceForUser(db, {
        isOwner: false,
        userId: 'user_1',
        workspaceId: 'workspace_1',
      }),
    ).resolves.toBe('left');

    expect(state.selectFrom).toHaveBeenCalledWith(projectMembersSchema);
    expect(state.remove.mock.calls.map(([table]) => table)).toStrictEqual(
      expect.arrayContaining([
        projectsSchema,
        projectAccessRequestsSchema,
        projectInvitationsSchema,
        projectMembersSchema,
        workspaceInvitationsSchema,
        workspaceAccessRequestsSchema,
        workspaceMembersSchema,
      ]),
    );
  });
});
