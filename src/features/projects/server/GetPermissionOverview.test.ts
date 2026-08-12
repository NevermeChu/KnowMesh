import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPermissionOverview } from './GetPermissionOverview';

const state = vi.hoisted(() => {
  const projectId = '01987654-3210-7000-8000-000000000001';
  const documentId = '01987654-3210-7000-8000-000000000002';
  const workspaceId = '01987654-3210-7000-8000-000000000010';
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
  const decision = {
    grants: [],
    isResourceOwner: false,
    permissions: ['project.read', 'project.update', 'document.read', 'document.update'],
  };
  const project = {
    id: projectId,
    kind: 'personal' as const,
    name: '产品知识库',
    workspaceId,
  };
  const authorizeWorkspace = vi.fn<
    () => Promise<{
      decision: { permissions: string[] };
      workspace: { id: string; name: string };
    }>
  >();
  const authorizeProject =
    vi.fn<() => Promise<{ decision: typeof decision; project: typeof project }>>();
  const authorizeDocument = vi.fn<
    () => Promise<{
      decision: typeof decision;
      document: { id: string; projectId: string; title: string };
      project: typeof project;
    }>
  >();
  const memberships = [
    { projectId, role: 'owner' as const, userId: 'user_owner' },
    { projectId, role: 'editor' as const, userId: 'user_1' },
    { projectId, role: 'viewer' as const, userId: 'user_viewer' },
  ];
  const orderBy = vi.fn<(order: unknown) => Promise<typeof memberships>>();
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const from = vi.fn<(table: unknown) => { where: typeof where }>(() => ({ where }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return {
    authorizeDocument,
    authorizeProject,
    authorizeWorkspace,
    clerkClient,
    decision,
    documentId,
    getUserList,
    memberships,
    orderBy,
    project,
    projectId,
    protect,
    select,
    workspaceId,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates identity lookup.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
  clerkClient: state.clerkClient,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from overview composition.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from overview composition.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization is tested independently from overview composition.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates membership lookup.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));

describe('permission overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.clerkClient.mockResolvedValue({ users: { getUserList: state.getUserList } });
    state.orderBy.mockResolvedValue(state.memberships);
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
    state.authorizeWorkspace.mockResolvedValue({
      decision: { permissions: ['workspace.read', 'workspace.update'] },
      workspace: { id: state.workspaceId, name: '产品团队' },
    });
    state.authorizeProject.mockResolvedValue({ decision: state.decision, project: state.project });
    state.authorizeDocument.mockResolvedValue({
      decision: state.decision,
      document: { id: state.documentId, projectId: state.projectId, title: '产品方案' },
      project: state.project,
    });
  });

  it('returns workspace members after authorization', async () => {
    const overview = await getPermissionOverview({
      scope: 'workspace',
      workspaceId: state.workspaceId,
    });

    expect(overview).toMatchObject({
      permissions: ['workspace.read', 'workspace.update'],
      scope: 'workspace',
      title: '工作区权限',
    });
    expect(overview.groups[0]?.members.map((member) => member.role)).toStrictEqual([
      'owner',
      'editor',
      'viewer',
    ]);
  });

  it('returns direct project members and capabilities', async () => {
    const overview = await getPermissionOverview({ projectId: state.projectId, scope: 'project' });

    expect(state.authorizeProject).toHaveBeenCalledWith({
      permission: 'project.read',
      projectId: state.projectId,
      userId: 'user_1',
    });
    expect(overview).toMatchObject({
      permissions: state.decision.permissions,
      project: { id: state.projectId, name: '产品知识库' },
      scope: 'project',
    });
  });

  it('returns inherited document capabilities', async () => {
    const overview = await getPermissionOverview({
      documentId: state.documentId,
      scope: 'document',
    });

    expect(overview).toMatchObject({
      document: { id: state.documentId, title: '产品方案' },
      permissions: state.decision.permissions,
      project: { id: state.projectId, name: '产品知识库' },
      scope: 'document',
    });
  });

  it('rejects inaccessible projects before member lookup', async () => {
    state.authorizeProject.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(
      getPermissionOverview({ projectId: state.projectId, scope: 'project' }),
    ).rejects.toThrow('没有权限执行该操作');
    expect(state.select).not.toHaveBeenCalled();
  });
});
