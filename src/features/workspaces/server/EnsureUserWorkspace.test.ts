import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureUserWorkspace } from './EnsureUserWorkspace';

/* oxlint-disable vitest/require-mock-type-parameters, promise/prefer-await-to-callbacks, typescript/no-unsafe-return -- Fluent Drizzle test doubles intentionally model heterogeneous query builders. */

const state = vi.hoisted(() => {
  const existingLimit = vi.fn();
  const existingWhere = vi.fn(() => ({ limit: existingLimit }));
  const existingFrom = vi.fn(() => ({ where: existingWhere }));
  const select = vi.fn(() => ({ from: existingFrom }));
  const workspaceReturning = vi.fn();
  const workspaceConflict = vi.fn(() => ({ returning: workspaceReturning }));
  const workspaceValues = vi.fn(() => ({ onConflictDoNothing: workspaceConflict }));
  const memberValues = vi.fn();
  let insertCount = 0;
  const insert = vi.fn(() => {
    insertCount += 1;
    return insertCount === 1 ? { values: workspaceValues } : { values: memberValues };
  });
  const transaction = vi.fn(async (callback) => await callback({ insert, select }));

  return {
    existingLimit,
    insert,
    memberValues,
    reset: () => {
      insertCount = 0;
    },
    transaction,
    workspaceReturning,
    workspaceValues,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- The fluent test double intentionally does not reproduce every Drizzle overload.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));

describe(ensureUserWorkspace, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reset();
  });

  it('returns existing personal workspace', async () => {
    state.existingLimit.mockResolvedValue([{ id: 'workspace_1' }]);

    await expect(ensureUserWorkspace('user_1')).resolves.toStrictEqual({ id: 'workspace_1' });
    expect(state.insert).not.toHaveBeenCalled();
  });

  it('creates permanent personal workspace', async () => {
    state.existingLimit.mockResolvedValueOnce([]);
    state.workspaceReturning.mockResolvedValue([{ id: 'workspace_1' }]);

    await expect(ensureUserWorkspace('user_1')).resolves.toStrictEqual({ id: 'workspace_1' });
    expect(state.workspaceValues).toHaveBeenCalledWith({
      kind: 'personal',
      name: '我的工作区',
      ownerId: 'user_1',
    });
    expect(state.memberValues).toHaveBeenCalledWith({
      role: 'owner',
      userId: 'user_1',
      workspaceId: 'workspace_1',
    });
  });
});
