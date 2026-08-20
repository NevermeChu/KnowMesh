import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsSchema } from '@/models/Schema';
import { syncPendingWorkspaceInvitations } from './SyncPendingInvitations';

type PendingInvitationRecord = {
  id: string;
  invitedById: string;
  workspaceId: string;
  workspaceName: string;
};

type ExistingNotificationRecord = {
  targetId: string | null;
};

const state = vi.hoisted(() => {
  const createNotification = vi.fn<() => Promise<void>>();
  const notificationsWhere = vi.fn<() => Promise<ExistingNotificationRecord[]>>();
  const invitationsWhere = vi.fn<() => Promise<PendingInvitationRecord[]>>();

  const innerJoin = vi.fn<
    (table: unknown, condition: unknown) => { where: typeof invitationsWhere }
  >(() => ({
    where: invitationsWhere,
  }));

  const select = vi.fn<(_fields?: unknown) => { from: (table: unknown) => unknown }>(() => ({
    from: vi.fn<(table: unknown) => unknown>((table: unknown) => {
      if (table === notificationsSchema) {
        return {
          where: notificationsWhere,
        };
      }
      return {
        innerJoin,
      };
    }),
  }));

  return {
    createNotification,
    invitationsWhere,
    notificationsWhere,
    select,
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

function expectWorkspaceInviteNotification() {
  expect(state.createNotification).toHaveBeenCalledExactlyOnceWith(
    expect.anything(),
    expect.objectContaining({
      body: '你收到了加入工作区“Team Alpha”的邀请。',
      recipientUserId: 'user_new',
      target: { id: 'workspace_1', kind: 'workspace' },
      title: '收到工作区邀请',
      type: 'workspace_invited',
    }),
  );
}

describe(syncPendingWorkspaceInvitations, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.invitationsWhere.mockResolvedValue([
      {
        id: 'invitation_1',
        invitedById: 'user_inviter',
        workspaceId: 'workspace_1',
        workspaceName: 'Team Alpha',
      },
    ]);
    state.notificationsWhere.mockResolvedValue([]);
  });

  it('ignores empty email list without querying', async () => {
    await syncPendingWorkspaceInvitations('user_new', []);

    expect(state.select).not.toHaveBeenCalled();
    expect(state.createNotification).not.toHaveBeenCalled();
  });

  it('creates workspace_invited notification for active pending invitations', async () => {
    await syncPendingWorkspaceInvitations('user_new', ['new@example.com']);

    expectWorkspaceInviteNotification();
  });

  it('skips notification creation if workspace_invited notification already exists', async () => {
    state.notificationsWhere.mockResolvedValue([{ targetId: 'workspace_1' }]);

    await syncPendingWorkspaceInvitations('user_new', ['new@example.com']);

    expect(state.createNotification).not.toHaveBeenCalled();
  });

  it('deduplicates multiple invitations for the same workspace into a single notification', async () => {
    state.invitationsWhere.mockResolvedValue([
      {
        id: 'invitation_1',
        invitedById: 'user_inviter',
        workspaceId: 'workspace_1',
        workspaceName: 'Team Alpha',
      },
      {
        id: 'invitation_2',
        invitedById: 'user_inviter',
        workspaceId: 'workspace_1',
        workspaceName: 'Team Alpha',
      },
      {
        id: 'invitation_3',
        invitedById: 'user_inviter',
        workspaceId: 'workspace_1',
        workspaceName: 'Team Alpha',
      },
    ]);

    await syncPendingWorkspaceInvitations('user_new', ['new@example.com']);

    expectWorkspaceInviteNotification();
  });
});
