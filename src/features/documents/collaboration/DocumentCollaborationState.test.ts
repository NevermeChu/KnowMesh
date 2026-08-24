/* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions are callback-based. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrInitializeDocumentCollaborationState } from './DocumentCollaborationState';

const state = vi.hoisted(() => {
  const forUpdate = vi.fn<() => Promise<unknown[]>>();
  const limit = vi.fn<() => { for: typeof forUpdate }>(() => ({ for: forUpdate }));
  const where = vi.fn<() => { limit: typeof limit }>(() => ({ limit }));
  const innerJoinSecond = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const innerJoinFirst = vi.fn<() => { innerJoin: typeof innerJoinSecond }>(() => ({
    innerJoin: innerJoinSecond,
  }));
  const stateLimit = vi.fn<() => Promise<unknown[]>>();
  const stateWhere = vi.fn<() => { limit: typeof stateLimit }>(() => ({ limit: stateLimit }));
  const from = vi.fn<() => { innerJoin: typeof innerJoinFirst; where: typeof stateWhere }>(() => ({
    innerJoin: innerJoinFirst,
    where: stateWhere,
  }));
  const select = vi.fn<() => { from: typeof from }>(() => ({ from }));
  const insert = vi.fn<() => unknown>();
  const transaction = vi.fn<
    (callback: (transaction: unknown) => Promise<unknown>) => Promise<unknown>
  >(async (callback) => await callback({ insert, select }));

  return { forUpdate, insert, transaction };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent transaction mock isolates workspace mode enforcement.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));

describe(getOrInitializeDocumentCollaborationState, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects personal workspace documents', async () => {
    state.forUpdate.mockResolvedValueOnce([
      {
        content: { content: [{ type: 'paragraph' }], type: 'doc' },
        contentSchemaVersion: 1,
        workspaceKind: 'personal',
      },
    ]);

    await expect(
      getOrInitializeDocumentCollaborationState('30000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('个人空间文档不支持协作状态');
    expect(state.insert).not.toHaveBeenCalled();
  });
});
