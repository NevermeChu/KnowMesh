import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeProject, getProjectAuthorization } from './ProjectAuthorization';

type AccessRow = {
  id: string;
  name: string;
  ownerId: string;
  projectRole: 'editor' | 'owner' | 'viewer' | null;
  workspaceId: string;
  workspaceRole: 'editor' | 'owner' | 'viewer';
  workspaceKind: 'personal' | 'team';
};

const state = vi.hoisted(() => {
  const limit = vi.fn<(count: number) => Promise<AccessRow[]>>();
  const where = vi.fn<(condition: unknown) => { limit: typeof limit }>(() => ({ limit }));
  const leftJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  let innerJoinCount = 0;
  const memberJoin = vi.fn<(table: unknown, condition: unknown) => { leftJoin: typeof leftJoin }>(
    () => ({ leftJoin }),
  );
  const innerJoin = vi.fn<() => { innerJoin: typeof memberJoin } | { leftJoin: typeof leftJoin }>(
    () => {
      innerJoinCount += 1;
      return innerJoinCount === 1 ? { innerJoin: memberJoin } : { leftJoin };
    },
  );
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({ innerJoin }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return {
    limit,
    reset: () => {
      innerJoinCount = 0;
    },
    select,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The marker module has no runtime behavior in unit tests.
vi.mock('server-only', () => ({}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates authorization composition.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));

describe('project authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reset();
  });

  it('inherits collaboration editing from workspace editor', async () => {
    state.limit.mockResolvedValueOnce([
      {
        id: '01987654-3210-7000-8000-000000000001',
        name: '协作知识库',
        ownerId: 'user_owner',
        projectRole: null,
        workspaceId: '01987654-3210-7000-8000-000000000010',
        workspaceRole: 'editor',
        workspaceKind: 'team',
      },
    ]);

    const authorization = await getProjectAuthorization({
      projectId: '01987654-3210-7000-8000-000000000001',
      userId: 'user_editor',
    });

    expect(authorization?.decision.permissions).toContain('document.update');
    expect(authorization?.decision.permissions).not.toContain('project.delete');
    expect(authorization?.decision.grants).toStrictEqual([{ role: 'editor', source: 'workspace' }]);
  });

  it('rejects personal project without direct permission', async () => {
    state.limit.mockResolvedValueOnce([
      {
        id: '01987654-3210-7000-8000-000000000001',
        name: '个人知识库',
        ownerId: 'user_owner',
        projectRole: null,
        workspaceId: '01987654-3210-7000-8000-000000000010',
        workspaceRole: 'owner',
        workspaceKind: 'personal',
      },
    ]);

    await expect(
      authorizeProject({
        permission: 'project.read',
        projectId: '01987654-3210-7000-8000-000000000001',
        userId: 'workspace_owner',
      }),
    ).rejects.toThrow('没有权限执行该操作');
  });
});
