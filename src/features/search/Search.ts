import type { DocumentKind } from '@/features/documents/Document';

export const searchFilters = ['all', 'personal', 'team'] as const;
export type SearchFilter = (typeof searchFilters)[number];

export type SearchResultItem = {
  documentId: string;
  kind: DocumentKind;
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
