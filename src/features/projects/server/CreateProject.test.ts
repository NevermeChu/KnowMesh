import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from './CreateProject';

type ProjectRecord = {
  createdAt: Date;
  id: string;
  kind: 'personal';
  name: string;
  updatedAt: Date;
  workspaceId: string;
};

const state = vi.hoisted(() => {
  const project: ProjectRecord = {
    createdAt: new Date('2026-08-04T00:00:00.000Z'),
    id: '01987654-3210-7000-8000-000000000001',
    kind: 'personal',
    name: '产品知识库',
    updatedAt: new Date('2026-08-04T00:00:00.000Z'),
    workspaceId: '01987654-3210-7000-8000-000000000010',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeWorkspace = vi.fn<
    (options: { permission: string; userId: string; workspaceId: string }) => Promise<{
      workspace: { id: string };
    }>
  >();
  const returning = vi.fn<() => Promise<ProjectRecord[]>>();
  const projectValues = vi.fn<(values: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const memberValues = vi.fn<(values: unknown) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  let insertCallCount = 0;
  const insert = vi.fn<
    (table: unknown) => { values: typeof memberValues } | { values: typeof projectValues }
  >(() => {
    insertCallCount += 1;
    return insertCallCount === 1 ? { values: projectValues } : { values: memberValues };
  });
  /* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions execute a callback by design. */
  const transaction = vi.fn<
    (callback: (transaction: { insert: typeof insert }) => Promise<unknown>) => Promise<unknown>
  >(async (callback) => await callback({ insert }));
  /* oxlint-enable promise/prefer-await-to-callbacks */

  return {
    authorizeWorkspace,
    memberValues,
    project,
    projectValues,
    protect,
    revalidatePath,
    resetInsertCount: () => {
      insertCallCount = 0;
    },
    returning,
    transaction,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { transaction: state.transaction },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The mock isolates capability authorization from persistence.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates cache invalidation.
vi.mock('next/cache', () => ({
  revalidatePath: state.revalidatePath,
}));

describe('project creation action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resetInsertCount();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.returning.mockResolvedValue([state.project]);
    state.authorizeWorkspace.mockResolvedValue({ workspace: { id: state.project.workspaceId } });
  });

  it('creates project with owner membership', async () => {
    await expect(
      createProject({
        kind: 'personal',
        name: '  产品知识库  ',
        workspaceId: state.project.workspaceId,
      }),
    ).resolves.toStrictEqual(state.project);

    expect(state.transaction).toHaveBeenCalledOnce();
    expect(state.projectValues).toHaveBeenCalledWith({
      kind: 'personal',
      name: '产品知识库',
      ownerId: 'user_1',
      workspaceId: state.project.workspaceId,
    });
    expect(state.memberValues).toHaveBeenCalledWith({
      projectId: state.project.id,
      role: 'owner',
      userId: 'user_1',
    });
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects invalid input before transaction', async () => {
    await expect(
      createProject({ kind: 'personal', name: '   ', workspaceId: state.project.workspaceId }),
    ).rejects.toThrow('请输入项目名称');

    expect(state.transaction).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects project creation outside accessible workspace', async () => {
    state.authorizeWorkspace.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(
      createProject({
        kind: 'personal',
        name: '产品知识库',
        workspaceId: state.project.workspaceId,
      }),
    ).rejects.toThrow('没有权限执行该操作');

    expect(state.transaction).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('stops member creation when project insert fails', async () => {
    state.returning.mockResolvedValueOnce([]);

    await expect(
      createProject({
        kind: 'personal',
        name: '产品知识库',
        workspaceId: state.project.workspaceId,
      }),
    ).rejects.toThrow('项目创建失败');
    expect(state.memberValues).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});
