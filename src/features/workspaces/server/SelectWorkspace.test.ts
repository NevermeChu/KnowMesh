import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectWorkspace } from './SelectWorkspace';

const state = vi.hoisted(() => {
  const workspaceId = '01987654-3210-7000-8000-000000000010';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const limit = vi.fn<(limit: number) => Promise<{ workspaceId: string }[]>>();
  const where = vi.fn<(condition: unknown) => { limit: typeof limit }>(() => ({ limit }));
  const from = vi.fn<(table: unknown) => { where: typeof where }>(() => ({ where }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));
  const cookieSet = vi.fn<(name: string, value: string, options: object) => void>();
  const cookies = vi.fn<() => Promise<{ set: typeof cookieSet }>>(async () => {
    await Promise.resolve();
    return { set: cookieSet };
  });
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return { cookieSet, cookies, limit, protect, revalidatePath, select, workspaceId };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates response cookies.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates cache invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { select: state.select },
}));

describe(selectWorkspace, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.limit.mockResolvedValue([{ workspaceId: state.workspaceId }]);
  });

  it('selects accessible workspace', async () => {
    await expect(selectWorkspace({ workspaceId: state.workspaceId })).resolves.toBeUndefined();
    expect(state.cookieSet).toHaveBeenCalledWith('knowmesh-active-workspace', state.workspaceId, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects inaccessible workspace', async () => {
    state.limit.mockResolvedValueOnce([]);

    await expect(selectWorkspace({ workspaceId: state.workspaceId })).rejects.toThrow(
      '没有权限访问该工作区',
    );
    expect(state.cookieSet).not.toHaveBeenCalled();
  });
});
