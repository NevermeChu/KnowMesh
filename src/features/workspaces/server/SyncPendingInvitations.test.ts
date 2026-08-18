import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncPendingWorkspaceInvitations } from './SyncPendingInvitations';

const state = vi.hoisted(() => {
  const createNotification = vi.fn<() => Promise<void>>();
  const selectWhere = vi.fn<
    (
      condition: unknown,
    ) => Promise<{ id: string; invitedById: string; workspaceId: string; workspaceName: string }[]>
  >(async () => {
    await Promise.resolve();
    return [
      {
        id: 'invitation_1',
        invitedById: 'user_inviter',
        workspaceId: 'workspace_1',
        workspaceName: 'Team Alpha',
      },
    ];
  });
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof selectWhere }>(
    () => ({
      where: selectWhere,
    }),
  );
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({
    innerJoin,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof from }>(() => ({ from }));

  return {
    createNotification,
    select,
    selectWhere,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates query.
vi.mock('@/libs/DB', () => ({
  db: {
    select: state.select,
  },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Notification delivery is verified through mock.
vi.mock('@/features/notifications/server/CreateNotification', () => ({
  createNotification: state.createNotification,
}));

describe(syncPendingWorkspaceInvitations, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores empty email list without querying', async () => {
    await syncPendingWorkspaceInvitations('user_new', []);

    expect(state.select).not.toHaveBeenCalled();
    expect(state.createNotification).not.toHaveBeenCalled();
  });

  it('creates workspace_invited notification for active pending invitations', async () => {
    await syncPendingWorkspaceInvitations('user_new', ['new@example.com']);

    expect(state.selectWhere).toHaveBeenCalledWith(expect.anything());
    expect(state.createNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: '你收到了加入工作区“Team Alpha”的邀请。',
        recipientUserId: 'user_new',
        target: { id: 'workspace_1', kind: 'workspace' },
        title: '收到工作区邀请',
        type: 'workspace_invited',
      }),
    );
  });
});
