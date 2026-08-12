import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDocument } from '@/features/documents/server/DeleteDocument';
import { deleteProject } from '@/features/projects/server/DeleteProject';
import { updateProject } from '@/features/projects/server/UpdateProject';
import { deleteWorkspace } from '@/features/workspaces/server/DeleteWorkspace';
import { updateWorkspace } from '@/features/workspaces/server/UpdateWorkspace';

const state = vi.hoisted(() => {
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const projectId = '01987654-3210-7000-8000-000000000001';
  const documentId = '01987654-3210-7000-8000-000000000002';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeWorkspace =
    vi.fn<
      (options: unknown) => Promise<{ workspace: { id: string; kind: 'personal' | 'team' } }>
    >();
  const authorizeProject = vi.fn<(options: unknown) => Promise<{ project: { id: string } }>>();
  const authorizeDocument =
    vi.fn<(options: unknown) => Promise<{ document: { id: string; projectId: string } }>>();
  const returning = vi.fn<() => Promise<{ id: string; name?: string; projectId?: string }[]>>();
  const where = vi.fn<(condition: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const set = vi.fn<(values: unknown) => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<(table: unknown) => { set: typeof set }>(() => ({ set }));
  const remove = vi.fn<(table: unknown) => { where: typeof where }>(() => ({ where }));
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const cookieDelete = vi.fn<(name: string) => void>();
  const cookieGet = vi.fn<(name: string) => { value: string } | undefined>();
  const cookies = vi
    .fn<() => Promise<{ delete: typeof cookieDelete; get: typeof cookieGet }>>()
    .mockResolvedValue({ delete: cookieDelete, get: cookieGet });

  return {
    authorizeDocument,
    authorizeProject,
    authorizeWorkspace,
    cookieDelete,
    cookieGet,
    cookies,
    documentId,
    projectId,
    protect,
    remove,
    revalidatePath,
    returning,
    set,
    update,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from persistence.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from persistence.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from persistence.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates mutation behavior.
vi.mock('@/libs/DB', () => ({ db: { delete: state.remove, update: state.update } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial headers mock verifies cookie cleanup.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

describe('resource mutation authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.authorizeWorkspace.mockResolvedValue({
      workspace: { id: state.workspaceId, kind: 'team' },
    });
    state.authorizeProject.mockResolvedValue({ project: { id: state.projectId } });
    state.authorizeDocument.mockResolvedValue({
      document: { id: state.documentId, projectId: state.projectId },
    });
  });

  it('updates workspace after capability authorization', async () => {
    state.returning.mockResolvedValueOnce([{ id: state.workspaceId, name: '产品团队' }]);

    await updateWorkspace({ name: '  产品团队  ', workspaceId: state.workspaceId });

    expect(state.authorizeWorkspace).toHaveBeenCalledWith({
      permission: 'workspace.update',
      userId: 'user_1',
      workspaceId: state.workspaceId,
    });
    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: '产品团队', updatedAt: expect.any(Date) }),
    );
  });

  it('deletes active workspace after owner authorization', async () => {
    state.returning.mockResolvedValueOnce([{ id: state.workspaceId }]);
    state.cookieGet.mockReturnValue({ value: state.workspaceId });

    await deleteWorkspace({ workspaceId: state.workspaceId });

    expect(state.authorizeWorkspace).toHaveBeenCalledWith({
      permission: 'workspace.delete',
      userId: 'user_1',
      workspaceId: state.workspaceId,
    });
    expect(state.cookieDelete).toHaveBeenCalledWith('knowmesh-active-workspace');
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

  it('updates project after capability authorization', async () => {
    state.returning.mockResolvedValueOnce([{ id: state.projectId, name: '产品知识库' }]);

    await updateProject({ name: '产品知识库', projectId: state.projectId });

    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'project.update',
      projectId: state.projectId,
      userId: 'user_1',
    });
  });

  it('deletes project after owner authorization', async () => {
    state.returning.mockResolvedValueOnce([{ id: state.projectId }]);

    await deleteProject({ projectId: state.projectId });

    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'project.delete',
      projectId: state.projectId,
      userId: 'user_1',
    });
  });

  it('deletes document after edit authorization', async () => {
    state.returning.mockResolvedValueOnce([{ id: state.documentId, projectId: state.projectId }]);

    await deleteDocument({ documentId: state.documentId });

    expect(state.authorizeDocument).toHaveBeenCalledWith({
      documentId: state.documentId,
      permission: 'document.delete',
      userId: 'user_1',
    });
  });

  it('stops mutation when authorization fails', async () => {
    state.authorizeProject.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(deleteProject({ projectId: state.projectId })).rejects.toThrow(
      '没有权限执行该操作',
    );
    expect(state.remove).not.toHaveBeenCalled();
  });
});
