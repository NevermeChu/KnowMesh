import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOrLeaveProject } from '@/features/projects/server/DeleteProject';
import { deleteOrLeaveWorkspace } from '@/features/workspaces/server/DeleteWorkspace';

/* oxlint-disable promise/prefer-await-to-callbacks -- The transaction test double executes the supplied callback. */

const state = vi.hoisted(() => {
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const projectId = '01987654-3210-7000-8000-000000000001';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeWorkspace = vi.fn<
    () => Promise<{
      workspace: { id: string; kind: 'personal' | 'team'; ownerId: string; role: string };
    }>
  >();
  const authorizeProject = vi.fn<() => Promise<{ project: { id: string; ownerId: string } }>>();
  const removeProjectForUser = vi.fn<() => Promise<'deleted' | 'left'>>();
  const removeWorkspaceForUser = vi.fn<() => Promise<'deleted' | 'left'>>();
  const transaction = vi.fn<
    (callback: (transaction: object) => Promise<unknown>) => Promise<unknown>
  >(async (callback) => await callback({}));
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const cookieDelete = vi.fn<(name: string) => void>();
  const cookieGet = vi.fn<(name: string) => { value: string } | undefined>();
  const cookies = vi.fn<() => Promise<{ delete: typeof cookieDelete; get: typeof cookieGet }>>(
    async () => {
      await Promise.resolve();
      return { delete: cookieDelete, get: cookieGet };
    },
  );

  return {
    authorizeProject,
    authorizeWorkspace,
    cookieDelete,
    cookieGet,
    cookies,
    projectId,
    protect,
    removeProjectForUser,
    removeWorkspaceForUser,
    revalidatePath,
    transaction,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Resource removal is tested independently.
vi.mock('@/features/permissions/server/ResourceRemoval', () => ({
  removeProjectForUser: state.removeProjectForUser,
  removeWorkspaceForUser: state.removeWorkspaceForUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates transaction wiring.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial headers mock verifies cookie cleanup.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

describe('resource deletion and exit actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: { id: state.workspaceId, kind: 'team', ownerId: 'user_1', role: 'owner' },
    });
    state.authorizeProject.mockResolvedValue({
      project: { id: state.projectId, ownerId: 'user_1' },
    });
    state.removeProjectForUser.mockResolvedValue('deleted');
    state.removeWorkspaceForUser.mockResolvedValue('deleted');
  });

  it('deletes owned workspace and clears active selection', async () => {
    state.cookieGet.mockReturnValue({ value: state.workspaceId });

    await expect(deleteOrLeaveWorkspace({ workspaceId: state.workspaceId })).resolves.toStrictEqual(
      { operation: 'deleted' },
    );

    expect(state.authorizeWorkspace).toHaveBeenCalledWith({
      permission: 'workspace.read',
      userId: 'user_1',
      workspaceId: state.workspaceId,
    });
    expect(state.removeWorkspaceForUser).toHaveBeenCalledWith(
      {},
      { isOwner: true, userId: 'user_1', workspaceId: state.workspaceId },
    );
    expect(state.cookieDelete).toHaveBeenCalledWith('knowmesh-active-workspace');
  });

  it('deletes owned personal workspace', async () => {
    state.authorizeWorkspace.mockResolvedValueOnce({
      workspace: { id: state.workspaceId, kind: 'personal', ownerId: 'user_1', role: 'owner' },
    });

    await expect(deleteOrLeaveWorkspace({ workspaceId: state.workspaceId })).resolves.toStrictEqual(
      { operation: 'deleted' },
    );

    expect(state.removeWorkspaceForUser).toHaveBeenCalledWith(
      {},
      { isOwner: true, userId: 'user_1', workspaceId: state.workspaceId },
    );
  });

  it('leaves workspace owned by another user', async () => {
    state.authorizeWorkspace.mockResolvedValueOnce({
      workspace: { id: state.workspaceId, kind: 'team', ownerId: 'user_owner', role: 'editor' },
    });
    state.removeWorkspaceForUser.mockResolvedValueOnce('left');

    await expect(deleteOrLeaveWorkspace({ workspaceId: state.workspaceId })).resolves.toStrictEqual(
      { operation: 'left' },
    );

    expect(state.removeWorkspaceForUser).toHaveBeenCalledWith(
      {},
      { isOwner: false, userId: 'user_1', workspaceId: state.workspaceId },
    );
  });

  it('deletes owned project', async () => {
    await expect(deleteOrLeaveProject({ projectId: state.projectId })).resolves.toStrictEqual({
      operation: 'deleted',
    });

    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'project.read',
      projectId: state.projectId,
      userId: 'user_1',
    });
    expect(state.removeProjectForUser).toHaveBeenCalledWith(
      {},
      { isOwner: true, projectId: state.projectId, userId: 'user_1' },
    );
  });

  it('leaves project owned by another user', async () => {
    state.authorizeProject.mockResolvedValueOnce({
      project: { id: state.projectId, ownerId: 'user_owner' },
    });
    state.removeProjectForUser.mockResolvedValueOnce('left');

    await expect(deleteOrLeaveProject({ projectId: state.projectId })).resolves.toStrictEqual({
      operation: 'left',
    });

    expect(state.removeProjectForUser).toHaveBeenCalledWith(
      {},
      { isOwner: false, projectId: state.projectId, userId: 'user_1' },
    );
  });
});
