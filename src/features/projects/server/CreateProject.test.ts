import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from './CreateProject';

type ProjectRecord = {
  id: string;
  workspaceId: string;
};

const state = vi.hoisted(() => {
  const project: ProjectRecord = {
    id: '01987654-3210-7000-8000-000000000001',
    workspaceId: '01987654-3210-7000-8000-000000000010',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const authorizeWorkspace = vi.fn<
    (options: { permission: string; userId: string; workspaceId: string }) => Promise<{
      workspace: { id: string; kind: 'personal' | 'team'; ownerId: string };
    }>
  >();
  const forUpdate = vi.fn<() => Promise<{ role: 'editor' | 'owner' | 'viewer' }[]>>();
  const membershipWhere = vi.fn<(condition: unknown) => { for: typeof forUpdate }>(() => ({
    for: forUpdate,
  }));
  const membershipFrom = vi.fn<(table: unknown) => { where: typeof membershipWhere }>(() => ({
    where: membershipWhere,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof membershipFrom }>(() => ({
    from: membershipFrom,
  }));
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
    (
      callback: (transaction: { insert: typeof insert; select: typeof select }) => Promise<unknown>,
    ) => Promise<unknown>
  >(async (callback) => await callback({ insert, select }));
  /* oxlint-enable promise/prefer-await-to-callbacks */

  return {
    authorizeWorkspace,
    forUpdate,
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
    state.forUpdate.mockResolvedValue([{ role: 'editor' }]);
    state.returning.mockResolvedValue([state.project]);
    state.authorizeWorkspace.mockResolvedValue({
      workspace: { id: state.project.workspaceId, kind: 'team', ownerId: 'user_owner' },
    });
  });

  it('creates project with owner membership', async () => {
    await expect(
      createProject({
        name: '  产品知识库  ',
        workspaceId: state.project.workspaceId,
      }),
    ).resolves.toBeUndefined();

    expect(state.forUpdate).toHaveBeenCalledWith('update');
    expect(state.projectValues).toHaveBeenCalledWith({
      name: '产品知识库',
      ownerId: 'user_1',
      workspaceId: state.project.workspaceId,
    });
    expect(state.memberValues).toHaveBeenCalledWith({
      projectId: state.project.id,
      role: 'owner',
      userId: 'user_1',
      workspaceId: state.project.workspaceId,
    });
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects project creation after concurrent member removal', async () => {
    state.forUpdate.mockResolvedValueOnce([]);

    await expect(
      createProject({
        name: '产品知识库',
        workspaceId: state.project.workspaceId,
      }),
    ).rejects.toThrow('没有权限执行该操作');

    expect(state.projectValues).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});
