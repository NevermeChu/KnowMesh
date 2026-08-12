import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureUserWorkspace } from './EnsureUserWorkspace';

/* oxlint-disable vitest/require-mock-type-parameters, promise/prefer-await-to-callbacks, typescript/no-unsafe-return -- Fluent Drizzle test doubles intentionally model heterogeneous query builders. */

const state = vi.hoisted(() => {
  const onboardingReturning = vi.fn();
  const onboardingConflict = vi.fn(() => ({ returning: onboardingReturning }));
  const onboardingValues = vi.fn(() => ({ onConflictDoNothing: onboardingConflict }));
  const workspaceReturning = vi.fn();
  const workspaceValues = vi.fn(() => ({ returning: workspaceReturning }));
  const memberValues = vi.fn();
  const membershipLimit = vi.fn();
  const membershipWhere = vi.fn(() => ({ limit: membershipLimit }));
  const membershipFrom = vi.fn(() => ({ where: membershipWhere }));
  const select = vi.fn(() => ({ from: membershipFrom }));
  let insertCount = 0;
  const insert = vi.fn(() => {
    insertCount += 1;
    if (insertCount === 1) {
      return { values: onboardingValues };
    }
    if (insertCount === 2) {
      return { values: workspaceValues };
    }
    return { values: memberValues };
  });
  const transaction = vi.fn(async (callback) => await callback({ insert, select }));

  return {
    insert,
    memberValues,
    membershipLimit,
    onboardingReturning,
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

  it('creates default workspace during first initialization', async () => {
    state.onboardingReturning.mockResolvedValue([{ userId: 'user_1' }]);
    state.membershipLimit.mockResolvedValue([]);
    state.workspaceReturning.mockResolvedValue([{ id: 'workspace_1' }]);

    await expect(ensureUserWorkspace('user_1')).resolves.toStrictEqual({ id: 'workspace_1' });
    expect(state.workspaceValues).toHaveBeenCalledWith({
      name: '我的工作区',
      ownerId: 'user_1',
    });
    expect(state.memberValues).toHaveBeenCalledWith({
      role: 'owner',
      userId: 'user_1',
      workspaceId: 'workspace_1',
    });
  });

  it('keeps zero workspaces after initialization', async () => {
    state.onboardingReturning.mockResolvedValue([]);

    await expect(ensureUserWorkspace('user_1')).resolves.toBeNull();
    expect(state.insert).toHaveBeenCalledOnce();
  });
});
