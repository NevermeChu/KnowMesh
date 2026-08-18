import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inviteWorkspaceMember,
  rejectWorkspaceAccessRequest,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
} from './WorkspaceMembers';

const state = vi.hoisted(() => {
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const invitationId = '01987654-3210-7000-8000-000000000020';
  const memberUserId = 'user_member';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const currentUser = vi.fn<() => Promise<unknown>>();
  const clerkClient = vi.fn<() => Promise<unknown>>();
  const sendWorkspaceInvitationEmail = vi.fn<() => Promise<void>>();
  const authorizeWorkspace = vi.fn<
    (options: unknown) => Promise<{
      workspace: { id: string; kind: 'personal' | 'team'; name: string; ownerId: string };
    }>
  >();
  const createNotification = vi.fn<() => Promise<void>>();
  const lockMember = vi.fn<() => Promise<{ userId: string }[]>>();
  const findOwnedProjects = vi.fn<() => Promise<{ id: string }[]>>();
  const findWorkspaceProjects = vi.fn<() => { id: string }[]>();
  const memberFor = vi.fn<(strength: 'update') => Promise<{ userId: string }[]>>(
    async () => await lockMember(),
  );
  const ownedProjectLimit = vi.fn<(limit: number) => Promise<{ id: string }[]>>(
    async () => await findOwnedProjects(),
  );
  let selectCallCount = 0;
  const selectWhere = vi.fn<(condition: unknown) => unknown>(() => {
    selectCallCount += 1;
    if (selectCallCount === 1) {
      return { for: memberFor };
    }
    if (selectCallCount === 2) {
      return { limit: ownedProjectLimit };
    }
    return findWorkspaceProjects();
  });
  const from = vi.fn<(table: unknown) => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof from }>(() => ({ from }));

  const deleteReturning = vi.fn<() => Promise<{ userId: string }[]>>(async () => {
    await Promise.resolve();
    return [{ userId: memberUserId }];
  });
  const deleteWhere = vi.fn<(condition: unknown) => unknown>(() => ({
    returning: deleteReturning,
  }));
  const remove = vi.fn<(table: unknown) => { where: typeof deleteWhere }>(() => ({
    where: deleteWhere,
  }));

  const insertReturning = vi.fn<() => Promise<{ id: string }[]>>(async () => {
    await Promise.resolve();
    return [{ id: invitationId }];
  });
  const insertValues = vi.fn<(values: unknown) => { returning: typeof insertReturning }>(() => ({
    returning: insertReturning,
  }));
  const insert = vi.fn<(table: unknown) => { values: typeof insertValues }>(() => ({
    values: insertValues,
  }));

  const updateReturning = vi.fn<() => Promise<{ id?: string; userId?: string }[]>>(async () => {
    await Promise.resolve();
    return [{ id: invitationId, userId: memberUserId }];
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
        select: typeof select;
        update: typeof update;
      }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ delete: remove, select, update }));
  /* oxlint-enable promise/prefer-await-to-callbacks */
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    authorizeWorkspace,
    clerkClient,
    createNotification,
    currentUser,
    deleteReturning,
    deleteWhere,
    findOwnedProjects,
    findWorkspaceProjects,
    insert,
    insertReturning,
    insertValues,
    invitationId,
    lockMember,
    memberFor,
    memberUserId,
    protect,
    remove,
    resetSelectCount: () => {
      selectCallCount = 0;
    },
    revalidatePath,
    select,
    sendWorkspaceInvitationEmail,
    transaction,
    update,
    updateReturning,
    updateSet,
    updateWhere,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
  clerkClient: state.clerkClient,
  currentUser: state.currentUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from persistence.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
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
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Invitation delivery is verified through mock.
vi.mock('@/features/emails/server/SendWorkspaceInvitationEmail', () => ({
  sendWorkspaceInvitationEmail: state.sendWorkspaceInvitationEmail,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Notification delivery is verified through mock.
vi.mock('@/features/notifications/server/CreateNotification', () => ({
  createNotification: state.createNotification,
}));

describe(removeWorkspaceMember, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resetSelectCount();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: {
        id: state.workspaceId,
        kind: 'team',
        name: 'Team Workspace',
        ownerId: 'user_owner',
      },
    });
    state.lockMember.mockResolvedValue([{ userId: state.memberUserId }]);
    state.findOwnedProjects.mockResolvedValue([]);
    state.findWorkspaceProjects.mockReturnValue([{ id: 'project_1' }]);
  });

  it('locks membership before checking owned projects', async () => {
    await expect(
      removeWorkspaceMember({
        memberUserId: state.memberUserId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toStrictEqual({ userId: state.memberUserId });

    expect(state.memberFor).toHaveBeenCalledWith('update');
    expect(state.lockMember.mock.invocationCallOrder[0]).toBeLessThan(
      state.findOwnedProjects.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(state.deleteWhere).toHaveBeenCalledTimes(5);
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('sends notification when member is removed by administrator', async () => {
    await removeWorkspaceMember({
      memberUserId: state.memberUserId,
      workspaceId: state.workspaceId,
    });

    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '已移出工作区',
        type: 'workspace_member_removed',
      }),
    );
  });

  it('rejects removal when member still owns project', async () => {
    state.findOwnedProjects.mockResolvedValueOnce([{ id: 'project_owned' }]);

    await expect(
      removeWorkspaceMember({
        memberUserId: state.memberUserId,
        workspaceId: state.workspaceId,
      }),
    ).rejects.toThrow('该成员仍拥有项目，请先转让或删除这些项目');

    expect(state.deleteWhere).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects removal when membership no longer exists', async () => {
    state.lockMember.mockResolvedValueOnce([]);

    await expect(
      removeWorkspaceMember({
        memberUserId: state.memberUserId,
        workspaceId: state.workspaceId,
      }),
    ).rejects.toThrow('工作区成员不存在');

    expect(state.findOwnedProjects).not.toHaveBeenCalled();
    expect(state.deleteWhere).not.toHaveBeenCalled();
  });
});

describe(updateWorkspaceMemberRole, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: {
        id: state.workspaceId,
        kind: 'team',
        name: 'Team Workspace',
        ownerId: 'user_owner',
      },
    });
    state.updateReturning.mockResolvedValue([{ userId: state.memberUserId }]);
  });

  it('updates member role directly to editor and cleans pending requests', async () => {
    await expect(
      updateWorkspaceMemberRole({
        memberUserId: state.memberUserId,
        role: 'editor',
        workspaceId: state.workspaceId,
      }),
    ).resolves.toStrictEqual({ userId: state.memberUserId });

    expect(state.updateSet).toHaveBeenCalledWith({ role: 'editor' });
    expect(state.deleteWhere).toHaveBeenCalledOnce();
    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '工作区角色变更',
        type: 'workspace_member_role_updated',
      }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects modifying role of workspace owner', async () => {
    await expect(
      updateWorkspaceMemberRole({
        memberUserId: 'user_owner',
        role: 'editor',
        workspaceId: state.workspaceId,
      }),
    ).rejects.toThrow('工作区所有者角色不可修改');
  });
});

describe(rejectWorkspaceAccessRequest, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: {
        id: state.workspaceId,
        kind: 'team',
        name: 'Team Workspace',
        ownerId: 'user_owner',
      },
    });
    state.deleteReturning.mockResolvedValue([{ userId: state.memberUserId }]);
  });

  it('deletes access request and sends rejection notification', async () => {
    await expect(
      rejectWorkspaceAccessRequest({
        memberUserId: state.memberUserId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toBeUndefined();

    expect(state.deleteWhere).toHaveBeenCalledWith(expect.anything());
    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '工作区权限申请未通过',
        type: 'workspace_access_rejected',
      }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});

describe(revokeWorkspaceInvitation, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: {
        id: state.workspaceId,
        kind: 'team',
        name: 'Team Workspace',
        ownerId: 'user_owner',
      },
    });
    state.updateReturning.mockResolvedValue([{ id: state.invitationId }]);
  });

  it('revokes pending invitation', async () => {
    await expect(
      revokeWorkspaceInvitation({
        invitationId: state.invitationId,
        workspaceId: state.workspaceId,
      }),
    ).resolves.toStrictEqual({ id: state.invitationId });

    expect(state.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects revoking non-existent invitation', async () => {
    state.updateReturning.mockResolvedValueOnce([]);

    await expect(
      revokeWorkspaceInvitation({
        invitationId: state.invitationId,
        workspaceId: state.workspaceId,
      }),
    ).rejects.toThrow('邀请不存在或已处理');
  });
});

describe(inviteWorkspaceMember, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: {
        id: state.workspaceId,
        kind: 'team',
        name: 'Team Workspace',
        ownerId: 'user_owner',
      },
    });
    state.currentUser.mockResolvedValue({
      firstName: 'Owner',
      fullName: 'Owner User',
      lastName: 'User',
      username: 'owner',
    });
    state.clerkClient.mockResolvedValue({
      users: {
        getUserList: vi
          .fn<
            () => Promise<{
              data: { emailAddresses: { emailAddress: string }[]; id: string }[];
            }>
          >()
          .mockResolvedValue({
            data: [
              {
                emailAddresses: [{ emailAddress: 'member@example.com' }],
                id: state.memberUserId,
              },
            ],
          }),
      },
    });
    state.lockMember.mockResolvedValue([]);
    state.insertReturning.mockResolvedValue([{ id: state.invitationId }]);
    state.sendWorkspaceInvitationEmail.mockResolvedValue();
  });

  it('invites registered user and creates workspace_invited notification', async () => {
    await expect(
      inviteWorkspaceMember({
        email: 'member@example.com',
        workspaceId: state.workspaceId,
      }),
    ).resolves.toStrictEqual({ id: state.invitationId });

    expect(state.sendWorkspaceInvitationEmail).toHaveBeenCalledOnce();
    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipientUserId: state.memberUserId,
        title: '收到工作区邀请',
        type: 'workspace_invited',
      }),
    );
  });
});
