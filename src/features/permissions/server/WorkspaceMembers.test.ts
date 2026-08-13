import { beforeEach, describe, expect, it, vi } from 'vitest';
import { removeWorkspaceMember } from './WorkspaceMembers';

const state = vi.hoisted(() => {
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const memberUserId = 'user_member';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeWorkspace = vi.fn<
    (options: unknown) => Promise<{
      workspace: { id: string; kind: 'personal' | 'team'; ownerId: string };
    }>
  >();
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
  const deleteWhere = vi.fn<(condition: unknown) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  const remove = vi.fn<(table: unknown) => { where: typeof deleteWhere }>(() => ({
    where: deleteWhere,
  }));
  /* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions execute a callback by design. */
  const transaction = vi.fn<
    (
      callback: (transaction: { delete: typeof remove; select: typeof select }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ delete: remove, select }));
  /* oxlint-enable promise/prefer-await-to-callbacks */
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    authorizeWorkspace,
    deleteWhere,
    findOwnedProjects,
    findWorkspaceProjects,
    lockMember,
    memberFor,
    memberUserId,
    protect,
    revalidatePath,
    resetSelectCount: () => {
      selectCallCount = 0;
    },
    transaction,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
  clerkClient: vi.fn<() => Promise<never>>(),
  currentUser: vi.fn<() => Promise<never>>(),
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from persistence.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates transaction behavior.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Invitation delivery is unrelated to member removal.
vi.mock('@/features/emails/server/SendWorkspaceInvitationEmail', () => ({
  sendWorkspaceInvitationEmail: vi.fn<() => Promise<never>>(),
}));

describe(removeWorkspaceMember, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resetSelectCount();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: { id: state.workspaceId, kind: 'team', ownerId: 'user_owner' },
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
