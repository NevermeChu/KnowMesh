import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkspaceNavigation } from './GetWorkspaceNavigation';

const state = vi.hoisted(() => {
  const project = {
    id: '01987654-3210-7000-8000-000000000001',
    name: '产品知识库',
    ownerId: 'user_1',
    projectRole: 'owner' as const,
    workspaceRole: 'owner' as const,
    workspaceKind: 'personal' as const,
  };
  const document = {
    id: '01987654-3210-7000-8000-000000000002',
    projectId: project.id,
    title: '产品方案',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const projectOrderBy = vi.fn<() => Promise<(typeof project)[]>>(async () => {
    await Promise.resolve();
    return [project];
  });
  const projectWhere = vi.fn<(condition: unknown) => { orderBy: typeof projectOrderBy }>(() => ({
    orderBy: projectOrderBy,
  }));
  const projectLeftJoin = vi.fn<
    (table: unknown, condition: unknown) => { where: typeof projectWhere }
  >(() => ({ where: projectWhere }));
  const workspaceMemberJoin = vi.fn<
    (table: unknown, condition: unknown) => { leftJoin: typeof projectLeftJoin }
  >(() => ({ leftJoin: projectLeftJoin }));
  let projectJoinCount = 0;
  const projectInnerJoin = vi.fn<
    (
      table: unknown,
      condition: unknown,
    ) => { innerJoin: typeof workspaceMemberJoin } | { leftJoin: typeof projectLeftJoin }
  >(() => {
    projectJoinCount += 1;
    return projectJoinCount === 1
      ? { innerJoin: workspaceMemberJoin }
      : { leftJoin: projectLeftJoin };
  });
  const documentOrderBy = vi.fn<() => Promise<(typeof document)[]>>(async () => {
    await Promise.resolve();
    return [document];
  });
  const documentWhere = vi.fn<(condition: unknown) => { orderBy: typeof documentOrderBy }>(() => ({
    orderBy: documentOrderBy,
  }));
  let selectCount = 0;
  const select = vi.fn<(selection: unknown) => object>(() => {
    selectCount += 1;

    return selectCount === 1
      ? {
          from: vi.fn<(table: unknown) => { innerJoin: typeof projectInnerJoin }>(() => ({
            innerJoin: projectInnerJoin,
          })),
        }
      : {
          from: vi.fn<(table: unknown) => { where: typeof documentWhere }>(() => ({
            where: documentWhere,
          })),
        };
  });

  return {
    document,
    documentWhere,
    project,
    projectWhere,
    protect,
    reset: () => {
      projectJoinCount = 0;
      selectCount = 0;
    },
    select,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The marker module has no runtime behavior in unit tests.
vi.mock('server-only', () => ({}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));

describe(getWorkspaceNavigation, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reset();
    state.project.ownerId = 'user_1';
    state.protect.mockResolvedValue({ userId: 'user_1' });
  });

  it('returns accessible projects and their documents', async () => {
    await expect(
      getWorkspaceNavigation({ workspaceId: '01987654-3210-7000-8000-000000000010' }),
    ).resolves.toStrictEqual({
      documents: [state.document],
      projects: [
        {
          id: state.project.id,
          name: state.project.name,
          permissions: [
            'project.read',
            'project.update',
            'project.delete',
            'document.read',
            'document.create',
            'document.update',
            'document.delete',
          ],
          workspaceKind: 'personal',
        },
      ],
    });
    expect(state.protect).toHaveBeenCalledOnce();
    expect(state.projectWhere).toHaveBeenCalledWith(expect.anything());
    expect(state.documentWhere).toHaveBeenCalledWith(expect.anything());
  });

  it('skips document query without accessible projects', async () => {
    state.project.ownerId = 'user_2';

    await expect(
      getWorkspaceNavigation({ workspaceId: '01987654-3210-7000-8000-000000000010' }),
    ).resolves.toStrictEqual({ documents: [], projects: [] });
    expect(state.select).toHaveBeenCalledOnce();
  });
});
