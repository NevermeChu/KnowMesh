import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteProject } from '@/features/projects/server/DeleteProject';
import { deleteWorkspace } from '@/features/workspaces/server/DeleteWorkspace';

const state = vi.hoisted(() => {
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const projectId = '01987654-3210-7000-8000-000000000001';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeWorkspace =
    vi.fn<() => Promise<{ workspace: { id: string; kind: 'personal' | 'team' } }>>();
  const authorizeProject = vi.fn<() => Promise<{ project: { id: string } }>>();
  const returning = vi.fn<() => Promise<{ id: string }[]>>();
  const where = vi.fn<(condition: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const remove = vi.fn<(table: unknown) => { where: typeof where }>(() => ({ where }));
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
    remove,
    revalidatePath,
    returning,
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
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates deletion behavior.
vi.mock('@/libs/DB', () => ({ db: { delete: state.remove } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial headers mock verifies cookie cleanup.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

describe('resource deletion actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: { id: state.workspaceId, kind: 'team' },
    });
    state.authorizeProject.mockResolvedValue({ project: { id: state.projectId } });
  });

  it('deletes active team workspace and clears selection', async () => {
    state.returning.mockResolvedValueOnce([{ id: state.workspaceId }]);
    state.cookieGet.mockReturnValue({ value: state.workspaceId });

    await deleteWorkspace({ workspaceId: state.workspaceId });

    expect(state.cookieDelete).toHaveBeenCalledWith('knowmesh-active-workspace');
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('preserves permanent personal workspace', async () => {
    state.authorizeWorkspace.mockResolvedValueOnce({
      workspace: { id: state.workspaceId, kind: 'personal' },
    });

    await expect(deleteWorkspace({ workspaceId: state.workspaceId })).rejects.toThrow(
      '个人空间不可删除',
    );
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('stops project deletion when authorization fails', async () => {
    state.authorizeProject.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(deleteProject({ projectId: state.projectId })).rejects.toThrow(
      '没有权限执行该操作',
    );
    expect(state.remove).not.toHaveBeenCalled();
  });
});
