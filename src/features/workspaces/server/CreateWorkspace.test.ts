import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace } from './CreateWorkspace';

const state = vi.hoisted(() => {
  const workspace = {
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    id: '01987654-3210-7000-8000-000000000010',
    name: '产品团队',
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const returning = vi.fn<() => Promise<(typeof workspace)[]>>();
  const workspaceValues = vi.fn<(values: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const memberValues = vi.fn<(values: unknown) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  let insertCallCount = 0;
  const insert = vi.fn<
    (table: unknown) => { values: typeof memberValues } | { values: typeof workspaceValues }
  >(() => {
    insertCallCount += 1;
    return insertCallCount === 1 ? { values: workspaceValues } : { values: memberValues };
  });
  /* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions execute a callback by design. */
  const transaction = vi.fn<
    (callback: (transaction: { insert: typeof insert }) => Promise<unknown>) => Promise<unknown>
  >(async (callback) => await callback({ insert }));
  /* oxlint-enable promise/prefer-await-to-callbacks */
  const cookieSet = vi.fn<(name: string, value: string, options: object) => void>();
  const cookies = vi.fn<() => Promise<{ set: typeof cookieSet }>>(async () => {
    await Promise.resolve();
    return { set: cookieSet };
  });
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    cookieSet,
    cookies,
    memberValues,
    protect,
    revalidatePath,
    resetInsertCount: () => {
      insertCallCount = 0;
    },
    returning,
    transaction,
    workspace,
    workspaceValues,
  };
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
  db: { transaction: state.transaction },
}));

describe(createWorkspace, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resetInsertCount();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.returning.mockResolvedValue([state.workspace]);
  });

  it('creates workspace with owner membership', async () => {
    await expect(createWorkspace({ name: '  产品团队  ' })).resolves.toStrictEqual(state.workspace);
    expect(state.workspaceValues).toHaveBeenCalledWith({ name: '产品团队', ownerId: 'user_1' });
    expect(state.memberValues).toHaveBeenCalledWith({
      role: 'owner',
      userId: 'user_1',
      workspaceId: state.workspace.id,
    });
    expect(state.cookieSet).toHaveBeenCalledWith('knowmesh-active-workspace', state.workspace.id, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});
