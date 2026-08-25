import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userSchema } from '@/models/Schema';
import { deleteAccount } from './DeleteAccount';

const state = vi.hoisted(() => {
  class TeamWorkspaceOwnershipError extends Error {
    override name = 'TeamWorkspaceOwnershipError';
  }
  const returning = vi.fn<() => Promise<{ id: string }[]>>();
  const where = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const deleteRow = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const transactionDatabase = { delete: deleteRow };
  /* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions require a callback. */
  const transaction = vi.fn<
    (callback: (database: typeof transactionDatabase) => Promise<void>) => Promise<void>
  >(async (callback) => {
    await callback(transactionDatabase);
  });
  /* oxlint-enable promise/prefer-await-to-callbacks */

  return {
    deleteRow,
    deleteUserData: vi.fn<() => Promise<void>>(),
    headers: vi.fn<() => Promise<Headers>>(),
    requireUser: vi.fn<() => Promise<{ id: string }>>(),
    returning,
    transaction,
    transactionDatabase,
    TeamWorkspaceOwnershipError,
    verifyPassword: vi.fn<() => Promise<{ status: boolean }>>(),
  };
});

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/headers'), () => ({ headers: state.headers }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates identity lookup.
vi.mock('@/features/auth/server/CurrentUser', () => ({ requireUser: state.requireUser }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cleanup mock verifies transaction composition.
vi.mock('@/features/users/server/DeleteUserData', () => ({
  deleteUserData: state.deleteUserData,
  TeamWorkspaceOwnershipError: state.TeamWorkspaceOwnershipError,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth API mock isolates password verification.
vi.mock('@/libs/Auth', () => ({ auth: { api: { verifyPassword: state.verifyPassword } } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock exposes the transaction boundary.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));

describe(deleteAccount, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.headers.mockResolvedValue(new Headers());
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.returning.mockResolvedValue([{ id: 'user_1' }]);
    state.verifyPassword.mockResolvedValue({ status: true });
  });

  it('rejects deletion before opening a transaction for an invalid password', async () => {
    state.verifyPassword.mockRejectedValue(
      APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'Invalid password' }),
    );

    await expect(deleteAccount({ password: 'wrong-password' })).resolves.toStrictEqual({
      reason: 'invalid-password',
      success: false,
    });
    expect(state.transaction).not.toHaveBeenCalled();
  });

  it('deletes business data and identity in one transaction', async () => {
    await expect(deleteAccount({ password: 'current-password' })).resolves.toStrictEqual({
      success: true,
    });

    expect(state.deleteUserData).toHaveBeenCalledWith(state.transactionDatabase, 'user_1');
    expect(state.deleteRow).toHaveBeenCalledWith(userSchema);
    expect(state.transaction).toHaveBeenCalledOnce();
  });

  it('fails the transaction when the identity no longer exists', async () => {
    state.returning.mockResolvedValue([]);

    await expect(deleteAccount({ password: 'current-password' })).rejects.toThrow('账户删除失败');
  });

  it('rejects deletion while user owns a team workspace', async () => {
    state.deleteUserData.mockRejectedValueOnce(new state.TeamWorkspaceOwnershipError());

    await expect(deleteAccount({ password: 'current-password' })).resolves.toStrictEqual({
      reason: 'team-workspace-owner',
      success: false,
    });
    expect(state.deleteRow).not.toHaveBeenCalledWith(userSchema);
  });
});
