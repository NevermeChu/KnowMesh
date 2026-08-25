import { describe, expect, it } from 'vitest';
import { planDocumentSortOrder } from './DocumentSortOrder';

describe(planDocumentSortOrder, () => {
  it('keeps requested order when adjacent gaps remain safe', () => {
    expect(
      planDocumentSortOrder({
        documentId: 'moving',
        requestedSortOrder: 1500,
        siblings: [
          { id: 'first', sortOrder: 1000 },
          { id: 'second', sortOrder: 2000 },
        ],
      }),
    ).toStrictEqual({ sortOrder: 1500, updates: [] });
  });

  it('rebalances siblings when a fractional gap is exhausted', () => {
    expect(
      planDocumentSortOrder({
        documentId: 'moving',
        requestedSortOrder: 1000.25,
        siblings: [
          { id: 'first', sortOrder: 1000 },
          { id: 'second', sortOrder: 1000.5 },
        ],
      }),
    ).toStrictEqual({
      sortOrder: 2000,
      updates: [
        { id: 'first', sortOrder: 1000 },
        { id: 'second', sortOrder: 3000 },
      ],
    });
  });

  it('rebalances before appending beyond safe precision', () => {
    expect(
      planDocumentSortOrder({
        documentId: 'moving',
        siblings: [{ id: 'first', sortOrder: Number.MAX_SAFE_INTEGER }],
      }),
    ).toStrictEqual({
      sortOrder: 2000,
      updates: [{ id: 'first', sortOrder: 1000 }],
    });
  });
});
