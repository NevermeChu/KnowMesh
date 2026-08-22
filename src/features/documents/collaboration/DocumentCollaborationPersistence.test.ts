/* oxlint-disable promise/prefer-await-to-callbacks -- Drizzle transactions are callback-based. */
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DOCUMENT_CONTENT } from '../Document';
import { persistDocumentCollaborationState } from './DocumentCollaborationPersistence';
import { documentContentToYDoc } from './DocumentCollaborationTransform';

const state = vi.hoisted(() => {
  const returning = vi.fn<() => Promise<unknown[]>>();
  const where = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const set = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<() => { set: typeof set }>(() => ({ set }));
  const transaction = vi.fn<
    (callback: (transaction: { update: typeof update }) => Promise<unknown>) => Promise<unknown>
  >(async (callback) => await callback({ update }));
  return { returning, transaction, update };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent transaction mock intentionally supplies a partial database.
vi.mock('@/libs/DB', () => ({ db: { transaction: state.transaction } }));

describe(persistDocumentCollaborationState, () => {
  it('rejects the transaction when JSON projection is missing', async () => {
    state.returning
      .mockResolvedValueOnce([{ documentId: '30000000-0000-4000-8000-000000000001' }])
      .mockResolvedValueOnce([]);

    await expect(
      persistDocumentCollaborationState({
        document: documentContentToYDoc(EMPTY_DOCUMENT_CONTENT),
        documentId: '30000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toThrow('协作文档正文投影失败');
  });
});
