import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectMembersSchema, projectsSchema, workspaceMembersSchema } from '@/models/Schema';
import { getProjects } from './GetProjects';

type ProjectRecord = {
  createdAt: Date;
  id: string;
  kind: 'personal';
  name: string;
  ownerId: string;
  projectRole: 'owner';
  updatedAt: Date;
  workspaceId: string;
  workspaceRole: 'owner';
};

const state = vi.hoisted(() => {
  const projects: ProjectRecord[] = [
    {
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      id: '01987654-3210-7000-8000-000000000001',
      kind: 'personal',
      name: '产品知识库',
      ownerId: 'user_1',
      projectRole: 'owner',
      updatedAt: new Date('2026-08-04T00:00:00.000Z'),
      workspaceId: '01987654-3210-7000-8000-000000000010',
      workspaceRole: 'owner',
    },
  ];
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const eq = vi.fn<(left: unknown, right: unknown) => object>((left, right) => ({
    left,
    operator: 'eq',
    right,
  }));
  const and = vi.fn<(...conditions: unknown[]) => object>((...conditions) => ({
    conditions,
    operator: 'and',
  }));
  const desc = vi.fn<(column: unknown) => object>((column) => ({ column, operator: 'desc' }));
  const orderBy = vi.fn<(order: unknown) => Promise<ProjectRecord[]>>(async () => {
    await Promise.resolve();
    return projects;
  });
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const leftJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { leftJoin: typeof leftJoin }>(
    () => ({ leftJoin }),
  );
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({ innerJoin }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return {
    and,
    desc,
    eq,
    innerJoin,
    leftJoin,
    projects,
    protect,
    select,
    where,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The marker module has no runtime behavior in unit tests.
vi.mock('server-only', () => ({}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Operator spies verify the generated access predicate.
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal()),
  and: state.and,
  desc: state.desc,
  eq: state.eq,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe('project queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
  });

  it('filters projects by authenticated membership', async () => {
    await expect(
      getProjects({ workspaceId: state.projects[0]?.workspaceId ?? '' }),
    ).resolves.toStrictEqual([
      {
        createdAt: state.projects[0]?.createdAt,
        id: state.projects[0]?.id,
        kind: 'personal',
        name: '产品知识库',
        permissions: [
          'project.read',
          'project.update',
          'project.delete',
          'project.members.manage',
          'document.read',
          'document.create',
          'document.update',
          'document.delete',
        ],
        role: 'owner',
        updatedAt: state.projects[0]?.updatedAt,
        workspaceId: state.projects[0]?.workspaceId,
      },
    ]);

    expect(state.eq).toHaveBeenCalledWith(workspaceMembersSchema.userId, 'user_1');
    expect(state.eq).toHaveBeenCalledWith(
      projectsSchema.workspaceId,
      state.projects[0]?.workspaceId,
    );
    expect(state.innerJoin).toHaveBeenCalledWith(workspaceMembersSchema, expect.anything());
    expect(state.leftJoin).toHaveBeenCalledWith(projectMembersSchema, expect.anything());
  });

  it('adds project kind filter', async () => {
    await getProjects({
      kind: 'collaboration',
      workspaceId: state.projects[0]?.workspaceId ?? '',
    });

    expect(state.eq).toHaveBeenCalledWith(projectsSchema.kind, 'collaboration');
    expect(state.and).toHaveBeenCalledTimes(3);
  });
});
