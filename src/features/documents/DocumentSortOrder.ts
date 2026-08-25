const SORT_ORDER_STEP = 1000;
const MIN_SORT_ORDER_GAP = 1;

type DocumentSortOrderSibling = {
  id: string;
  sortOrder: number;
};

/**
 * Plans a stable fractional position and rebalances siblings when gaps become unsafe.
 *
 * @param options - Moving document, requested position, and locked target siblings.
 * @returns The position to store and any sibling positions that must be normalized.
 */
export function planDocumentSortOrder(options: {
  documentId: string;
  requestedSortOrder?: number;
  siblings: DocumentSortOrderSibling[];
}) {
  const siblings = options.siblings
    .filter((sibling) => sibling.id !== options.documentId)
    .toSorted((left, right) => left.sortOrder - right.sortOrder);
  const { requestedSortOrder } = options;
  const insertionIndex =
    requestedSortOrder === undefined
      ? siblings.length
      : siblings.findIndex((sibling) => sibling.sortOrder >= requestedSortOrder);
  const normalizedInsertionIndex = insertionIndex === -1 ? siblings.length : insertionIndex;
  const previous = siblings[normalizedInsertionIndex - 1];
  const next = siblings[normalizedInsertionIndex];
  const candidate = requestedSortOrder ?? (siblings.at(-1)?.sortOrder ?? 0) + SORT_ORDER_STEP;
  const needsRebalance =
    !Number.isFinite(candidate) ||
    Math.abs(candidate) > Number.MAX_SAFE_INTEGER - SORT_ORDER_STEP ||
    (previous !== undefined && candidate - previous.sortOrder < MIN_SORT_ORDER_GAP) ||
    (next !== undefined && next.sortOrder - candidate < MIN_SORT_ORDER_GAP);

  if (!needsRebalance) {
    return { sortOrder: candidate, updates: [] as DocumentSortOrderSibling[] };
  }

  const updates = siblings.map((sibling, index) => ({
    id: sibling.id,
    sortOrder: (index + (index >= normalizedInsertionIndex ? 2 : 1)) * SORT_ORDER_STEP,
  }));

  return {
    sortOrder: (normalizedInsertionIndex + 1) * SORT_ORDER_STEP,
    updates,
  };
}
