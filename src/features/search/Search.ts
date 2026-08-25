export const searchFilters = ['all', 'personal', 'team'] as const;
export type SearchFilter = (typeof searchFilters)[number];

export type SearchResultItem = {
  documentId: string;
  projectId: string;
  projectName: string;
  snippet: string;
  title: string;
  updatedAt: Date;
  workspaceId: string;
  workspaceKind: 'personal' | 'team';
  workspaceName: string;
};

export type SearchResults = {
  hasMore: boolean;
  items: SearchResultItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

/**
 * Extracts all plain text recursively from a ProseMirror document tree.
 *
 * @param node - The document node or JSON object.
 * @returns Concatenated plain text content.
 */
export function extractPlainText(node: unknown): string {
  if (typeof node !== 'object' || node === null) {
    return '';
  }

  let text = '';

  if ('text' in node && typeof node.text === 'string') {
    text += node.text;
  }

  if ('content' in node && Array.isArray(node.content)) {
    for (const child of node.content) {
      const childText = extractPlainText(child);
      if (childText) {
        text +=
          (text.length > 0 && !text.endsWith(' ') && !text.endsWith('\n') ? ' ' : '') + childText;
      }
    }
  }

  return text.trim();
}

/**
 * Extracts a relevant text snippet centered around the query keyword.
 *
 * @param fullText - The full plain text.
 * @param query - The search query term.
 * @param maxLength - Maximum snippet length.
 * @returns Clean snippet with ellipsis if truncated.
 */
export function extractSnippet(fullText: string, query: string, maxLength = 140): string {
  if (!fullText) {
    return '';
  }

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return fullText.length > maxLength ? `${fullText.slice(0, maxLength).trim()}…` : fullText;
  }

  const lowerText = fullText.toLowerCase();
  const matchIndex = lowerText.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return fullText.length > maxLength ? `${fullText.slice(0, maxLength).trim()}…` : fullText;
  }

  const leadLength = Math.floor(maxLength / 3);
  const start = Math.max(0, matchIndex - leadLength);
  const end = Math.min(fullText.length, start + maxLength);
  let snippet = fullText.slice(start, end).trim();

  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < fullText.length) {
    snippet = `${snippet}…`;
  }

  return snippet;
}
