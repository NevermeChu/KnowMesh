/* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions are callback-based. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/features/permissions/AuthorizationError';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';
import { deleteOrLeaveWorkspace } from './DeleteWorkspace';

const state = vi.hoisted(() => {
  const requireUser = vi.fn<() => Promise<{ id: string }>>();
  const authorizeWorkspace = vi.fn<() => Promise<unknown>>();
  const removeWorkspaceForUser = vi.fn<() => Promise<'deleted' | 'left'>>();
  const deleteCookie = vi.fn<(name: string) => void>();
  const getCookie = vi.fn<(name: string) => { value: string } | null>(() => null);
  const cookies = vi.fn<() => Promise<{ delete: typeof deleteCookie; get: typeof getCookie }>>(
    async () => await Promise.resolve({ delete: deleteCookie, get: getCookie }),
  );
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const recordAuditLog = vi.fn<() => Promise<void>>();
  const transaction = vi.fn<(callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(
    async (callback) => await callback({}),
  );

  return {
    authorizeWorkspace,
    cookies,
    deleteCookie,
    getCookie,
    removeWorkspaceForUser,
    requireUser,
    revalidatePath,
    recordAuditLog,
    transaction,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial audit mock verifies transaction composition.
vi.mock('@/features/audit-logs/server/RecordAuditLog', () => ({
  recordAuditLog: state.recordAuditLog,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial next/cache mock isolates layout revalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial next/headers mock isolates cookies.
vi.mock('next/headers', () => ({ cookies: state.cookies }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates user identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({
  requireUser: state.requireUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial permissions mock isolates workspace authorization.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial resource removal mock isolates database removal.
vi.mock('@/features/permissions/server/ResourceRemoval', () => ({
  removeWorkspaceForUser: state.removeWorkspaceForUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate database transaction.
vi.mock('@/libs/DB', () => ({
  db: { transaction: state.transaction },
}));

describe(deleteOrLeaveWorkspace, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.removeWorkspaceForUser.mockResolvedValue('deleted');
    state.getCookie.mockReturnValue(null);
  });

  it('rejects deletion of personal workspace', async () => {
    state.authorizeWorkspace.mockResolvedValueOnce({
      decision: { permissions: ['workspace.read', 'workspace.update', 'project.create'] },
      workspace: {
        id: '10000000-0000-4000-8000-000000000001',
        kind: 'personal',
        name: '我的工作区',
        ownerId: 'user_1',
        role: 'owner',
      },
    });

    await expect(
      deleteOrLeaveWorkspace({ workspaceId: '10000000-0000-4000-8000-000000000001' }),
    ).rejects.toThrow('个人空间不可删除或退出');

    expect(state.removeWorkspaceForUser).not.toHaveBeenCalled();
  });

  it('rejects deletion of team workspace when owner lacks delete permission', async () => {
    state.authorizeWorkspace.mockResolvedValueOnce({
      decision: { permissions: ['workspace.read'] },
      workspace: {
        id: '10000000-0000-4000-8000-000000000002',
        kind: 'team',
        name: '团队工作区',
        ownerId: 'user_1',
        role: 'owner',
      },
    });

    await expect(
      deleteOrLeaveWorkspace({ workspaceId: '10000000-0000-4000-8000-000000000002' }),
    ).rejects.toThrow(AuthorizationError);

    expect(state.removeWorkspaceForUser).not.toHaveBeenCalled();
  });

  it('deletes team workspace when owner has delete permission and clears cookie', async () => {
    const workspaceId = '10000000-0000-4000-8000-000000000002';
    state.authorizeWorkspace.mockResolvedValueOnce({
      decision: {
        permissions: [
          'workspace.read',
          'workspace.update',
          'workspace.delete',
          'workspace.members.manage',
          'project.create',
        ],
      },
      workspace: {
        id: workspaceId,
        kind: 'team',
        name: '团队工作区',
        ownerId: 'user_1',
        role: 'owner',
      },
    });
    state.getCookie.mockReturnValueOnce({ value: workspaceId });

    const result = await deleteOrLeaveWorkspace({ workspaceId });

    expect(result).toStrictEqual({ operation: 'deleted' });
    expect(state.removeWorkspaceForUser).toHaveBeenCalledWith(expect.anything(), {
      isOwner: true,
      userId: 'user_1',
      workspaceId,
    });
    expect(state.recordAuditLog).toHaveBeenCalledWith(expect.anything(), {
      action: 'workspace_deleted',
      actorUserId: 'user_1',
      metadata: { resourceName: '团队工作区' },
      targetId: workspaceId,
      targetKind: 'workspace',
      workspaceId,
    });
    expect(state.deleteCookie).toHaveBeenCalledWith(ACTIVE_WORKSPACE_COOKIE);
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('leaves team workspace for non-owner member', async () => {
    const workspaceId = '10000000-0000-4000-8000-000000000002';
    state.authorizeWorkspace.mockResolvedValueOnce({
      decision: { permissions: ['workspace.read'] },
      workspace: {
        id: workspaceId,
        kind: 'team',
        name: '团队工作区',
        ownerId: 'user_owner',
        role: 'viewer',
      },
    });
    state.removeWorkspaceForUser.mockResolvedValueOnce('left');

    const result = await deleteOrLeaveWorkspace({ workspaceId });

    expect(result).toStrictEqual({ operation: 'left' });
    expect(state.removeWorkspaceForUser).toHaveBeenCalledWith(expect.anything(), {
      isOwner: false,
      userId: 'user_1',
      workspaceId,
    });
    expect(state.recordAuditLog).not.toHaveBeenCalled();
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});
