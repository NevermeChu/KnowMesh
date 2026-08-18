import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inviteProjectMember,
  rejectProjectAccessRequest,
  rejectProjectInvitation,
  removeProjectMember,
  revokeProjectInvitation,
  updateProjectMemberRole,
} from './ProjectMembers';

const state = vi.hoisted(() => {
  const projectId = '01987654-3210-7000-8000-000000000030';
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const memberUserId = 'user_member';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeProject = vi.fn<
    (options: unknown) => Promise<{
      decision: { permissions: string[] };
      project: {
        id: string;
        name: string;
        ownerId: string;
        workspaceId: string;
        workspaceKind: 'personal' | 'team';
      };
    }>
  >();
  const createNotification = vi.fn<() => Promise<void>>();

  const selectLimit = vi.fn<
    () => Promise<{ userId?: string; name?: string; requestedRole?: string }[]>
  >(async () => {
    await Promise.resolve();
    return [{ name: 'Test Project', userId: memberUserId }];
  });
  const selectWhere = vi.fn<(condition: unknown) => { limit: typeof selectLimit }>(() => ({
    limit: selectLimit,
  }));
  const from = vi.fn<(table: unknown) => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof from }>(() => ({ from }));

  const deleteReturning = vi.fn<() => Promise<{ requestedRole?: string; userId?: string }[]>>(
    async () => {
      await Promise.resolve();
      return [{ requestedRole: 'editor', userId: memberUserId }];
    },
  );
  const deleteWhere = vi.fn<(condition: unknown) => unknown>(() => ({
    returning: deleteReturning,
  }));
  const remove = vi.fn<(table: unknown) => { where: typeof deleteWhere }>(() => ({
    where: deleteWhere,
  }));

  const insertReturning = vi.fn<() => Promise<{ projectId: string }[]>>(async () => {
    await Promise.resolve();
    return [{ projectId }];
  });
  const insertOnConflictDoNothing = vi.fn<() => { returning: typeof insertReturning }>(() => ({
    returning: insertReturning,
  }));
  const insertValues = vi.fn<
    (values: unknown) => { onConflictDoNothing: typeof insertOnConflictDoNothing }
  >(() => ({
    onConflictDoNothing: insertOnConflictDoNothing,
  }));
  const insert = vi.fn<(table: unknown) => { values: typeof insertValues }>(() => ({
    values: insertValues,
  }));

  const updateReturning = vi.fn<() => Promise<{ userId?: string }[]>>(async () => {
    await Promise.resolve();
    return [{ userId: memberUserId }];
  });
  const updateWhere = vi.fn<(condition: unknown) => { returning: typeof updateReturning }>(() => ({
    returning: updateReturning,
  }));
  const updateSet = vi.fn<(values: unknown) => { where: typeof updateWhere }>(() => ({
    where: updateWhere,
  }));
  const update = vi.fn<(table: unknown) => { set: typeof updateSet }>(() => ({
    set: updateSet,
  }));

  /* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions execute a callback by design. */
  const transaction = vi.fn<
    (
      callback: (transaction: {
        delete: typeof remove;
        insert: typeof insert;
        select: typeof select;
        update: typeof update;
      }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ delete: remove, insert, select, update }));
  /* oxlint-enable promise/prefer-await-to-callbacks */
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    authorizeProject,
    createNotification,
    deleteReturning,
    deleteWhere,
    insert,
    insertOnConflictDoNothing,
    insertReturning,
    insertValues,
    memberUserId,
    projectId,
    protect,
    remove,
    revalidatePath,
    select,
    selectLimit,
    transaction,
    update,
    updateReturning,
    updateSet,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from persistence.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates transaction behavior.
vi.mock('@/libs/DB', () => ({
  db: {
    delete: state.remove,
    insert: state.insert,
    select: state.select,
    transaction: state.transaction,
    update: state.update,
  },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Notification delivery is verified through mock.
vi.mock('@/features/notifications/server/CreateNotification', () => ({
  createNotification: state.createNotification,
}));

describe(updateProjectMemberRole, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeProject.mockResolvedValue({
      decision: { permissions: ['project.members.manage'] },
      project: {
        id: state.projectId,
        name: 'Test Project',
        ownerId: 'user_owner',
        workspaceId: state.workspaceId,
        workspaceKind: 'team',
      },
    });
    state.selectLimit.mockResolvedValue([{ userId: state.memberUserId }]);
    state.updateReturning.mockResolvedValue([{ userId: state.memberUserId }]);
  });

  it('updates project member role directly to editor and cleans pending requests', async () => {
    await expect(
      updateProjectMemberRole({
        memberUserId: state.memberUserId,
        projectId: state.projectId,
        role: 'editor',
      }),
    ).resolves.toStrictEqual({ userId: state.memberUserId });

    expect(state.updateSet).toHaveBeenCalledWith({ role: 'editor' });
    expect(state.deleteWhere).toHaveBeenCalledOnce();
    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '项目角色变更',
        type: 'project_member_role_updated',
      }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects modifying role of project owner', async () => {
    await expect(
      updateProjectMemberRole({
        memberUserId: 'user_owner',
        projectId: state.projectId,
        role: 'editor',
      }),
    ).rejects.toThrow('项目所有者角色不可修改或移除');
  });
});

describe(rejectProjectAccessRequest, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeProject.mockResolvedValue({
      decision: { permissions: ['project.members.manage'] },
      project: {
        id: state.projectId,
        name: 'Test Project',
        ownerId: 'user_owner',
        workspaceId: state.workspaceId,
        workspaceKind: 'team',
      },
    });
    state.selectLimit.mockResolvedValue([{ name: 'Test Project', userId: state.memberUserId }]);
    state.deleteReturning.mockResolvedValue([
      { requestedRole: 'editor', userId: state.memberUserId },
    ]);
  });

  it('deletes access request and sends rejection notification', async () => {
    await expect(
      rejectProjectAccessRequest({
        memberUserId: state.memberUserId,
        projectId: state.projectId,
      }),
    ).resolves.toBeUndefined();

    expect(state.deleteWhere).toHaveBeenCalledWith(expect.anything());
    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '项目权限申请未通过',
        type: 'project_access_rejected',
      }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});

describe(removeProjectMember, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeProject.mockResolvedValue({
      decision: { permissions: ['project.members.manage'] },
      project: {
        id: state.projectId,
        name: 'Test Project',
        ownerId: 'user_owner',
        workspaceId: state.workspaceId,
        workspaceKind: 'team',
      },
    });
    state.selectLimit.mockResolvedValue([{ userId: state.memberUserId }]);
    state.deleteReturning.mockResolvedValue([{ userId: state.memberUserId }]);
  });

  it('removes member from project and sends notification', async () => {
    await expect(
      removeProjectMember({
        memberUserId: state.memberUserId,
        projectId: state.projectId,
      }),
    ).resolves.toStrictEqual({ userId: state.memberUserId });

    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '已移出项目',
        type: 'project_member_removed',
      }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});

describe(inviteProjectMember, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeProject.mockResolvedValue({
      decision: { permissions: ['project.members.manage'] },
      project: {
        id: state.projectId,
        name: 'Test Project',
        ownerId: 'user_owner',
        workspaceId: state.workspaceId,
        workspaceKind: 'team',
      },
    });
    state.selectLimit
      .mockResolvedValueOnce([{ userId: state.memberUserId }])
      .mockResolvedValueOnce([]);
    state.insertReturning.mockResolvedValue([{ projectId: state.projectId }]);
  });

  it('invites project member and creates project_invited notification', async () => {
    await expect(
      inviteProjectMember({
        memberUserId: state.memberUserId,
        projectId: state.projectId,
      }),
    ).resolves.toStrictEqual({ userId: state.memberUserId });

    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '收到项目邀请',
        type: 'project_invited',
      }),
    );
  });
});

describe(revokeProjectInvitation, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeProject.mockResolvedValue({
      decision: { permissions: ['project.members.manage'] },
      project: {
        id: state.projectId,
        name: 'Test Project',
        ownerId: 'user_owner',
        workspaceId: state.workspaceId,
        workspaceKind: 'team',
      },
    });
    state.selectLimit.mockResolvedValue([{ userId: state.memberUserId }]);
    state.deleteReturning.mockResolvedValue([{ userId: state.memberUserId }]);
  });

  it('revokes project invitation', async () => {
    await expect(
      revokeProjectInvitation({
        memberUserId: state.memberUserId,
        projectId: state.projectId,
      }),
    ).resolves.toStrictEqual({ userId: state.memberUserId });

    expect(state.deleteWhere).toHaveBeenCalledWith(expect.anything());
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects revoking non-existent project invitation', async () => {
    state.deleteReturning.mockResolvedValueOnce([]);

    await expect(
      revokeProjectInvitation({
        memberUserId: state.memberUserId,
        projectId: state.projectId,
      }),
    ).rejects.toThrow('邀请不存在或已处理');
  });
});

describe(rejectProjectInvitation, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: state.memberUserId });
  });

  it('rejects project invitation by invitee', async () => {
    await expect(
      rejectProjectInvitation({
        projectId: state.projectId,
      }),
    ).resolves.toBeUndefined();

    expect(state.deleteWhere).toHaveBeenCalledWith(expect.anything());
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});
