import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkspaceContext } from './GetWorkspaceContext';

const state = vi.hoisted(() => {
  const workspaces = [
    {
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
      id: '01987654-3210-7000-8000-000000000010',
      name: '产品团队',
      role: 'owner' as const,
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    },
    {
      createdAt: new Date('2026-08-11T00:00:00.000Z'),
      id: '01987654-3210-7000-8000-000000000011',
      name: '技术团队',
      role: 'editor' as const,
      updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    },
  ];
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const orderBy = vi.fn<(order: unknown) => Promise<typeof workspaces>>();
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({ innerJoin }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));
  const cookieGet = vi.fn<(name: string) => { value: string } | undefined>();
  const cookies = vi.fn<() => Promise<{ get: typeof cookieGet }>>(async () => {
    await Promise.resolve();
    return { get: cookieGet };
  });

  return { cookieGet, cookies, orderBy, protect, select, workspaces };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The marker module has no runtime behavior in unit tests.
vi.mock('server-only', () => ({}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates request cookies.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe(getWorkspaceContext, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.orderBy.mockResolvedValue(state.workspaces);
  });

  it('selects the requested accessible workspace', async () => {
    state.cookieGet.mockReturnValue({ value: state.workspaces[1]?.id ?? '' });

    await expect(getWorkspaceContext()).resolves.toStrictEqual({
      activeWorkspace: state.workspaces[1],
      workspaces: state.workspaces,
    });
  });

  it('falls back to the first accessible workspace', async () => {
    state.cookieGet.mockReturnValue({ value: '01987654-3210-7000-8000-000000000099' });

    await expect(getWorkspaceContext()).resolves.toStrictEqual({
      activeWorkspace: state.workspaces[0],
      workspaces: state.workspaces,
    });
  });
});
