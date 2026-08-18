import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { ensureUserWorkspace } from './EnsureUserWorkspace';

const state = vi.hoisted(() => {
  const selectLimit = vi.fn<() => Promise<{ id: string }[]>>();
  const selectWhere = vi.fn<(condition: unknown) => { limit: typeof selectLimit }>(() => ({
    limit: selectLimit,
  }));
  const selectFrom = vi.fn<(table: unknown) => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const select = vi.fn<(fields: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));
  const returning = vi.fn<() => Promise<{ id: string }[]>>();
  const onConflictDoNothing = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const workspaceValues = vi.fn<
    (values: unknown) => { onConflictDoNothing: typeof onConflictDoNothing }
  >(() => ({ onConflictDoNothing }));
  const memberValues = vi.fn<(values: unknown) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  const insert = vi.fn<(table: unknown) => { values: (values: unknown) => unknown }>();
  type TransactionCallback = (transaction: {
    insert: typeof insert;
    select: typeof select;
  }) => Promise<unknown>;
  const transaction = vi.fn<(callback: TransactionCallback) => Promise<unknown>>(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Drizzle transactions require a callback.
    async (callback) => await callback({ insert, select }),
  );

  return {
    insert,
    memberValues,
    returning,
    selectLimit,
    transaction,
    workspaceValues,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent transaction mock isolates idempotent provisioning.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));

describe(ensureUserWorkspace, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.insert.mockReturnValueOnce({ values: state.workspaceValues });
    state.insert.mockReturnValueOnce({ values: state.memberValues });
  });

  it('returns existing personal workspace without inserting', async () => {
    state.selectLimit.mockResolvedValueOnce([{ id: 'workspace_existing' }]);

    await expect(ensureUserWorkspace('user_1')).resolves.toStrictEqual({
      id: 'workspace_existing',
    });
    expect(state.insert).not.toHaveBeenCalled();
  });

  it('creates personal workspace and owner membership once', async () => {
    state.selectLimit.mockResolvedValueOnce([]);
    state.returning.mockResolvedValueOnce([{ id: 'workspace_new' }]);

    await expect(ensureUserWorkspace('user_1')).resolves.toStrictEqual({ id: 'workspace_new' });
    expect(state.insert.mock.calls.map(([table]) => table)).toStrictEqual([
      workspacesSchema,
      workspaceMembersSchema,
    ]);
    expect(state.memberValues).toHaveBeenCalledWith({
      role: 'owner',
      userId: 'user_1',
      workspaceId: 'workspace_new',
    });
  });

  it('returns concurrently created personal workspace after conflict', async () => {
    state.selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'workspace_concurrent' }]);
    state.returning.mockResolvedValueOnce([]);

    await expect(ensureUserWorkspace('user_1')).resolves.toStrictEqual({
      id: 'workspace_concurrent',
    });
    expect(state.insert).toHaveBeenCalledOnce();
  });
});
