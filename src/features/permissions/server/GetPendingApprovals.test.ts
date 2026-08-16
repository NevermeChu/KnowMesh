import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPendingApprovals } from './GetPendingApprovals';

vi.mock(import('server-only'), () => ({}));

type MockChain = {
  from: ReturnType<typeof vi.fn<(table: unknown) => unknown>>;
  limit: ReturnType<typeof vi.fn<(count: number) => Promise<unknown[]>>>;
  where: ReturnType<typeof vi.fn<(condition: unknown) => unknown>>;
};

function createMockChain(rows: unknown[]): MockChain {
  const limit = vi.fn<(count: number) => Promise<unknown[]>>(async () => {
    await Promise.resolve();
    return rows;
  });
  const orderBy = vi.fn<(column: unknown) => { limit: typeof limit }>(() => ({ limit }));
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({ innerJoin }));

  return { from, limit, where };
}

const state = vi.hoisted(() => {
  const workspaceRequest = {
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    requestedRole: 'editor',
    resourceName: '团队空间',
  };
  const projectRequest = {
    createdAt: new Date('2026-08-02T10:00:00.000Z'),
    requestedRole: 'viewer',
    resourceName: '产品知识库',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const desc = vi.fn<(column: unknown) => unknown>((column) => column);
  const eq = vi.fn<
    (column: unknown, value: unknown) => { column: unknown; operation: string; value: unknown }
  >((column, value) => ({ column, operation: 'eq', value }));

  const workspaceChain = createMockChain([workspaceRequest]);
  const projectChain = createMockChain([projectRequest]);
  let selectIndex = 0;
  const select = vi.fn<(selection: unknown) => { from: unknown }>(() => {
    selectIndex += 1;

    return selectIndex === 1 ? { from: workspaceChain.from } : { from: projectChain.from };
  });

  return {
    desc,
    eq,
    protect,
    projectChain,
    reset: () => {
      selectIndex = 0;
    },
    select,
    workspaceChain,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Query operators are inspected as test values.
vi.mock('drizzle-orm', () => ({ desc: state.desc, eq: state.eq }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates select behavior.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Column markers make ownership assertions explicit.
vi.mock('@/models/Schema', () => ({
  projectAccessRequestsSchema: {
    createdAt: 'project_access_requests.createdAt',
    projectId: 'project_access_requests.projectId',
    requestedRole: 'project_access_requests.requestedRole',
  },
  projectsSchema: { id: 'projects.id', name: 'projects.name', ownerId: 'projects.ownerId' },
  workspaceAccessRequestsSchema: {
    createdAt: 'workspace_access_requests.createdAt',
    requestedRole: 'workspace_access_requests.requestedRole',
    workspaceId: 'workspace_access_requests.workspaceId',
  },
  workspacesSchema: { id: 'workspaces.id', name: 'workspaces.name', ownerId: 'workspaces.ownerId' },
}));

describe(getPendingApprovals, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reset();
    state.protect.mockResolvedValue({ userId: 'user_owner' });
  });

  it('scopes requests to resources owned by the authenticated user', async () => {
    const approvals = await getPendingApprovals();

    expect(state.workspaceChain.where).toHaveBeenCalledWith({
      column: 'workspaces.ownerId',
      operation: 'eq',
      value: 'user_owner',
    });
    expect(state.eq).toHaveBeenCalledWith('workspaces.ownerId', 'user_owner');
    expect(state.eq).toHaveBeenCalledWith('projects.ownerId', 'user_owner');
    expect(approvals).toHaveLength(2);
  });

  it('merges workspace and project requests newest first', async () => {
    const approvals = await getPendingApprovals();

    expect(approvals[0]).toMatchObject({ kind: 'project', resourceName: '产品知识库' });
    expect(approvals[1]).toMatchObject({ kind: 'workspace', resourceName: '团队空间' });
  });
});
