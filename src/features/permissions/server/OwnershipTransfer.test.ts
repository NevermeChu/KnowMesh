import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { sendWorkspaceInvitationEmail as sendWorkspaceInvitationEmailFunction } from '@/features/emails/server/SendWorkspaceInvitationEmail';
import {
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  workspaceAccessRequestsSchema,
} from '@/models/Schema';
import { transferProjectOwnership } from './ProjectMembers';
import { transferWorkspaceOwnership } from './WorkspaceMembers';

const state = vi.hoisted(() => {
  const currentUser = { email: 'owner@example.com', id: 'user_owner', name: 'Owner' };
  const requireUser = vi.fn<() => Promise<typeof currentUser>>();

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

  const onConflictDoUpdate = vi.fn<(options: unknown) => Promise<unknown[]>>();
  const insertValues = vi.fn<
    (values: unknown) => { onConflictDoUpdate: typeof onConflictDoUpdate }
  >(() => ({ onConflictDoUpdate }));
  const insert = vi.fn<(table: unknown) => { values: typeof insertValues }>(() => ({
    values: insertValues,
  }));

  const selectFor = vi.fn<(mode: string) => Promise<unknown[]>>();
  const selectWhere = vi.fn<(condition: unknown) => { for: typeof selectFor }>(() => ({
    for: selectFor,
  }));
  const selectFrom = vi.fn<(table: unknown) => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));

  type TransactionCallback = (transaction: {
    delete: typeof remove;
    insert: typeof insert;
    select: typeof select;
    update: typeof update;
  }) => Promise<unknown>;

  /* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions require a callback. */
  const transaction = vi.fn<(callback: TransactionCallback) => Promise<unknown>>(
    async (callback) => await callback({ delete: remove, insert, select, update }),
  );
  /* oxlint-enable promise/prefer-await-to-callbacks */

  const createNotification = vi.fn<() => Promise<void>>();
  const revalidatePath = vi.fn<(url: string, type: 'layout' | 'page') => void>();
  const sendWorkspaceInvitationEmail = vi.fn<typeof sendWorkspaceInvitationEmailFunction>();

  const authorizeWorkspace = vi.fn<() => Promise<unknown>>();
  const authorizeProject = vi.fn<() => Promise<unknown>>();

  return {
    authorizeProject,
    authorizeWorkspace,
    createNotification,
    currentUser,
    deleteWhere,
    insert,
    onConflictDoUpdate,
    remove,
    requireUser,
    revalidatePath,
    sendWorkspaceInvitationEmail,
    select,
    selectFor,
    selectFrom,
    selectWhere,
    transaction,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/features/emails/server/SendWorkspaceInvitationEmail'), () => ({
  sendWorkspaceInvitationEmail: state.sendWorkspaceInvitationEmail,
}));
vi.mock(import('@/utils/Helpers'), () => ({ getBaseUrl: () => 'http://localhost:3008' }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock isolates revalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({ requireUser: state.requireUser }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial notification mock tracks notification events.
vi.mock('@/features/notifications/server/CreateNotification', () => ({
  createNotification: state.createNotification,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates workspace capability check.
vi.mock('./WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates project capability check.
vi.mock('./ProjectAuthorization', () => ({ authorizeProject: state.authorizeProject }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent database mock isolates ownership transfer branching.
vi.mock('@/libs/DB', () => ({
  db: {
    delete: state.remove,
    insert: state.insert,
    select: state.select,
    transaction: state.transaction,
    update: state.update,
  },
}));

describe('ownership transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue(state.currentUser);
    state.deleteWhere.mockResolvedValue([]);
    state.updateWhere.mockResolvedValue([]);
    state.onConflictDoUpdate.mockResolvedValue([]);
    state.selectFor.mockResolvedValue([]);
    state.createNotification.mockResolvedValue();
  });

  describe(transferWorkspaceOwnership, () => {
    it('rejects transfer when target user is self', async () => {
      await expect(
        transferWorkspaceOwnership({
          targetUserId: 'user_owner',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('不能将工作区所有权转让给自己');
    });

    it('rejects transfer for personal workspace', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'personal',
          name: 'Personal',
          ownerId: 'user_owner',
        },
      });

      await expect(
        transferWorkspaceOwnership({
          targetUserId: 'user_target',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('个人空间不支持所有权转让');
    });

    it('rejects transfer when current user is not workspace owner', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          name: 'Team',
          ownerId: 'user_other',
        },
      });

      await expect(
        transferWorkspaceOwnership({
          targetUserId: 'user_target',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('只有工作区所有者可以转让所有权');
    });

    it('rejects transfer when target user is not a workspace member', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          name: 'Team',
          ownerId: 'user_owner',
        },
      });
      state.selectFor
        .mockResolvedValueOnce([
          {
            kind: 'team',
            ownerId: 'user_owner',
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        transferWorkspaceOwnership({
          targetUserId: 'user_target',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('目标用户不是该工作区成员');
    });

    it('rejects transfer when workspace owner changes before transaction lock', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          name: 'Team',
          ownerId: 'user_owner',
        },
      });
      state.selectFor.mockResolvedValueOnce([{ kind: 'team', ownerId: 'user_other' }]);

      await expect(
        transferWorkspaceOwnership({
          targetUserId: 'user_target',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('工作区所有权已发生变化，请刷新后重试');
    });

    it('successfully transfers workspace ownership and notifies new owner', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          name: 'Team Workspace',
          ownerId: 'user_owner',
        },
      });
      state.selectFor
        .mockResolvedValueOnce([{ kind: 'team', ownerId: 'user_owner' }])
        .mockResolvedValueOnce([{ role: 'editor', userId: 'user_target' }])
        .mockResolvedValueOnce([{ role: 'owner', userId: 'user_owner' }]);

      const result = await transferWorkspaceOwnership({
        targetUserId: 'user_target',
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result).toStrictEqual({
        newOwnerId: 'user_target',
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });
      expect(state.remove).toHaveBeenCalledWith(workspaceAccessRequestsSchema);
      expect(state.createNotification).toHaveBeenCalledWith(expect.anything(), {
        actorUserId: 'user_owner',
        body: '你已成为工作区“Team Workspace”的所有者。',
        recipientUserId: 'user_target',
        target: { id: '11111111-1111-4111-8111-111111111111', kind: 'workspace' },
        title: '工作区所有权转让',
        type: 'workspace_member_role_updated',
      });
      expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
    });
  });

  describe(transferProjectOwnership, () => {
    it('rejects transfer when target user is self', async () => {
      await expect(
        transferProjectOwnership({
          projectId: '22222222-2222-4222-8222-222222222222',
          targetUserId: 'user_owner',
        }),
      ).rejects.toThrow('不能将项目所有权转让给自己');
    });

    it('rejects transfer for personal project', async () => {
      state.authorizeProject.mockResolvedValueOnce({
        project: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Personal Project',
          ownerId: 'user_owner',
          workspaceId: '11111111-1111-4111-8111-111111111111',
          workspaceKind: 'personal',
        },
      });

      await expect(
        transferProjectOwnership({
          projectId: '22222222-2222-4222-8222-222222222222',
          targetUserId: 'user_target',
        }),
      ).rejects.toThrow('个人空间不支持所有权转让');
    });

    it('rejects transfer when current user is not project owner', async () => {
      state.authorizeProject.mockResolvedValueOnce({
        project: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Team Project',
          ownerId: 'user_other',
          workspaceId: '11111111-1111-4111-8111-111111111111',
          workspaceKind: 'team',
        },
      });

      await expect(
        transferProjectOwnership({
          projectId: '22222222-2222-4222-8222-222222222222',
          targetUserId: 'user_target',
        }),
      ).rejects.toThrow('只有项目所有者可以转让所有权');
    });

    it('rejects transfer when target user is not a member of the workspace', async () => {
      state.authorizeProject.mockResolvedValueOnce({
        project: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Team Project',
          ownerId: 'user_owner',
          workspaceId: '11111111-1111-4111-8111-111111111111',
          workspaceKind: 'team',
        },
      });
      state.selectFor
        .mockResolvedValueOnce([
          {
            ownerId: 'user_owner',
            workspaceId: '11111111-1111-4111-8111-111111111111',
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        transferProjectOwnership({
          projectId: '22222222-2222-4222-8222-222222222222',
          targetUserId: 'user_target',
        }),
      ).rejects.toThrow('目标用户不是该工作区成员');
    });

    it('rejects transfer when project owner changes before transaction lock', async () => {
      state.authorizeProject.mockResolvedValueOnce({
        project: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Team Project',
          ownerId: 'user_owner',
          workspaceId: '11111111-1111-4111-8111-111111111111',
          workspaceKind: 'team',
        },
      });
      state.selectFor.mockResolvedValueOnce([
        {
          ownerId: 'user_other',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        },
      ]);

      await expect(
        transferProjectOwnership({
          projectId: '22222222-2222-4222-8222-222222222222',
          targetUserId: 'user_target',
        }),
      ).rejects.toThrow('项目所有权已发生变化，请刷新后重试');
    });

    it('successfully transfers project ownership and notifies new owner', async () => {
      state.authorizeProject.mockResolvedValueOnce({
        project: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Team Project',
          ownerId: 'user_owner',
          workspaceId: '11111111-1111-4111-8111-111111111111',
          workspaceKind: 'team',
        },
      });
      state.selectFor
        .mockResolvedValueOnce([
          {
            ownerId: 'user_owner',
            workspaceId: '11111111-1111-4111-8111-111111111111',
          },
        ])
        .mockResolvedValueOnce([{ userId: 'user_target' }])
        .mockResolvedValueOnce([{ role: 'owner', userId: 'user_owner' }]);

      const result = await transferProjectOwnership({
        projectId: '22222222-2222-4222-8222-222222222222',
        targetUserId: 'user_target',
      });

      expect(result).toStrictEqual({
        newOwnerId: 'user_target',
        projectId: '22222222-2222-4222-8222-222222222222',
      });
      expect(state.remove).toHaveBeenCalledWith(projectAccessRequestsSchema);
      expect(state.remove).toHaveBeenCalledWith(projectInvitationsSchema);
      expect(state.createNotification).toHaveBeenCalledWith(expect.anything(), {
        actorUserId: 'user_owner',
        body: '你已成为项目“Team Project”的所有者。',
        recipientUserId: 'user_target',
        target: { id: '22222222-2222-4222-8222-222222222222', kind: 'project' },
        title: '项目所有权转让',
        type: 'project_member_role_updated',
      });
    });
  });
});
