/* oxlint-disable vitest/prefer-import-in-mock -- Loose fluent database mocks cannot satisfy the production module type. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkspaceNavigation } from './GetWorkspaceNavigation';

const state = vi.hoisted(() => {
  const orderBy = vi.fn<() => Promise<unknown[]>>();
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy,
    where: () => chain,
  };
  const select = vi.fn<() => typeof chain>(() => chain);
  const getProjectPermissionDecision = vi.fn<() => { permissions: string[] }>();
  const requireUser = vi.fn<() => Promise<{ id: string }>>();

  return { getProjectPermissionDecision, orderBy, requireUser, select };
});

vi.mock('server-only', () => ({}));
vi.mock('@/features/auth/server/CurrentUser', () => ({ requireUser: state.requireUser }));
vi.mock('@/features/permissions/PermissionPolicy', () => ({
  getProjectPermissionDecision: state.getProjectPermissionDecision,
}));
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));

describe(getWorkspaceNavigation, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue({ id: 'user-1' });
    state.getProjectPermissionDecision.mockReturnValue({
      permissions: ['project.structure.read'],
    });
    state.orderBy.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Project',
        ownerId: 'user-1',
        projectRole: 'owner',
        workspaceKind: 'personal',
        workspaceRole: 'owner',
      },
    ]);
  });

  it('returns projects without eager document query', async () => {
    await expect(getWorkspaceNavigation({ workspaceId: 'workspace-1' })).resolves.toStrictEqual({
      projects: [
        {
          id: 'project-1',
          name: 'Project',
          permissions: ['project.structure.read'],
          workspaceKind: 'personal',
        },
      ],
    });

    expect(state.select).toHaveBeenCalledOnce();
  });
});
