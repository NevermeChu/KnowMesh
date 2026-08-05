import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPermissionOverview } from './GetPermissionOverview';

const state = vi.hoisted(() => {
  const projectId = '01987654-3210-7000-8000-000000000001';
  const documentId = '01987654-3210-7000-8000-000000000002';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const getUserList = vi.fn<
    (options: unknown) => Promise<{
      data: {
        emailAddresses: { emailAddress: string; id: string }[];
        firstName: string | null;
        id: string;
        imageUrl: string;
        lastName: string | null;
        primaryEmailAddressId: string | null;
        username: string | null;
      }[];
    }>
  >();
  const clerkClient = vi.fn<() => Promise<{ users: { getUserList: typeof getUserList } }>>();
  const getProjects = vi.fn<
    (options: unknown) => Promise<
      {
        createdAt: Date;
        id: string;
        kind: 'personal' | 'collaboration';
        name: string;
        role: 'owner' | 'editor' | 'viewer';
        updatedAt: Date;
      }[]
    >
  >();
  const getProjectAccess = vi.fn<
    (options: unknown) => Promise<{
      id: string;
      kind: 'personal' | 'collaboration';
      name: string;
      role: 'owner' | 'editor' | 'viewer';
    } | null>
  >();
  const getDocumentAccess = vi.fn<
    (options: unknown) => Promise<{
      projectId: string;
      role: 'owner' | 'editor' | 'viewer';
    } | null>
  >();
  const memberships = [
    { projectId, role: 'owner' as const, userId: 'user_owner' },
    { projectId, role: 'editor' as const, userId: 'user_1' },
    { projectId, role: 'viewer' as const, userId: 'user_viewer' },
  ];
  const resource = {
    documentTitle: '产品方案',
    projectId,
    projectName: '产品知识库',
  };
  const orderBy = vi.fn<(order: unknown) => Promise<typeof memberships>>(async () => {
    await Promise.resolve();
    return memberships;
  });
  const limit = vi.fn<(count: number) => Promise<(typeof resource)[]>>(async () => {
    await Promise.resolve();
    return [resource];
  });
  const where = vi.fn<(condition: unknown) => { limit: typeof limit; orderBy: typeof orderBy }>(
    () => ({ limit, orderBy }),
  );
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin; where: typeof where }>(
    () => ({ innerJoin, where }),
  );
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return {
    clerkClient,
    documentId,
    getDocumentAccess,
    getProjectAccess,
    getProjects,
    getUserList,
    memberships,
    protect,
    projectId,
    select,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
  clerkClient: state.clerkClient,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Access helpers are isolated to test permission overview composition.
vi.mock('@/features/documents/server/DocumentAccess', () => ({
  getDocumentAccess: state.getDocumentAccess,
  getProjectAccess: state.getProjectAccess,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Project discovery is isolated to test workspace grouping.
vi.mock('./GetProjects', () => ({
  getProjects: state.getProjects,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe('permission overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.clerkClient.mockResolvedValue({ users: { getUserList: state.getUserList } });
    state.getUserList.mockResolvedValue({
      data: [
        {
          emailAddresses: [{ emailAddress: 'owner@example.com', id: 'email_owner' }],
          firstName: '项目',
          id: 'user_owner',
          imageUrl: '',
          lastName: '所有者',
          primaryEmailAddressId: 'email_owner',
          username: null,
        },
        {
          emailAddresses: [{ emailAddress: 'me@example.com', id: 'email_me' }],
          firstName: '当前',
          id: 'user_1',
          imageUrl: '',
          lastName: '用户',
          primaryEmailAddressId: 'email_me',
          username: null,
        },
        {
          emailAddresses: [{ emailAddress: 'viewer@example.com', id: 'email_viewer' }],
          firstName: '只读',
          id: 'user_viewer',
          imageUrl: '',
          lastName: '成员',
          primaryEmailAddressId: 'email_viewer',
          username: null,
        },
      ],
    });
    state.getProjects.mockResolvedValue([
      {
        createdAt: new Date('2026-08-04T00:00:00.000Z'),
        id: state.projectId,
        kind: 'personal',
        name: '产品知识库',
        role: 'editor',
        updatedAt: new Date('2026-08-04T00:00:00.000Z'),
      },
    ]);
    state.getProjectAccess.mockResolvedValue({
      id: state.projectId,
      kind: 'personal',
      name: '产品知识库',
      role: 'editor',
    });
    state.getDocumentAccess.mockResolvedValue({ projectId: state.projectId, role: 'editor' });
  });

  it('groups workspace permissions by accessible project', async () => {
    const overview = await getPermissionOverview({ kind: 'personal', scope: 'workspace' });

    expect(state.getProjects).toHaveBeenCalledWith({ kind: 'personal' });
    expect(overview.groups).toHaveLength(1);
    expect(overview.groups[0]?.members.map((member) => member.role)).toStrictEqual([
      'owner',
      'editor',
      'viewer',
    ]);
    expect(overview.groups[0]?.members[1]).toMatchObject({
      displayName: '当前 用户',
      isCurrentUser: true,
    });
  });

  it('returns project members after resource authorization', async () => {
    const overview = await getPermissionOverview({ projectId: state.projectId, scope: 'project' });

    expect(state.getProjectAccess).toHaveBeenCalledWith({
      projectId: state.projectId,
      userId: 'user_1',
    });
    expect(overview.title).toBe('产品知识库 · 项目权限');
    expect(overview.groups[0]?.members).toHaveLength(3);
  });

  it('describes inherited document permissions', async () => {
    const overview = await getPermissionOverview({
      documentId: state.documentId,
      scope: 'document',
    });

    expect(state.getDocumentAccess).toHaveBeenCalledWith({
      documentId: state.documentId,
      userId: 'user_1',
    });
    expect(overview.title).toBe('产品方案 · 文件权限');
    expect(overview.description).toContain('完整继承项目“产品知识库”');
  });

  it('rejects inaccessible projects', async () => {
    state.getProjectAccess.mockResolvedValueOnce(null);

    await expect(
      getPermissionOverview({ projectId: state.projectId, scope: 'project' }),
    ).rejects.toThrow('没有权限查看该项目');
    expect(state.select).not.toHaveBeenCalled();
  });
});
