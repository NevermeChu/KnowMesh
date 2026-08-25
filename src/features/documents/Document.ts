export const DOCUMENT_CONTENT_SCHEMA_VERSION = 1;

export type DocumentEditorMode = 'collaborative' | 'collaborative-readonly' | 'single-user';

export type JsonValue = boolean | number | string | null | JsonValue[] | JsonObject;

export type JsonObject = {
  [key: string]: JsonValue;
};

export type DocumentMark = {
  attrs?: JsonObject;
  type: string;
};

export type DocumentNode = {
  attrs?: JsonObject;
  content?: DocumentNode[];
  marks?: DocumentMark[];
  text?: string;
  type: string;
};

export type DocumentContent = DocumentNode & {
  type: 'doc';
};

export type Document = {
  content: DocumentContent;
  contentSchemaVersion: number;
  createdAt: Date;
  id: string;
  isStarred?: boolean;
  parentId: string | null;
  projectId: string;
  sortOrder: number;
  title: string;
  titleVersion: number;
  updatedAt: Date;
};

export type DocumentNavigationItem = Pick<
  Document,
  'id' | 'parentId' | 'projectId' | 'sortOrder' | 'title'
> & { hasChildren: boolean };

export type DocumentNavigationCursor = Pick<DocumentNavigationItem, 'id' | 'sortOrder'>;

export type DocumentNavigationPage = {
  items: DocumentNavigationItem[];
  nextCursor: DocumentNavigationCursor | null;
};

export const EMPTY_DOCUMENT_CONTENT: DocumentContent = {
  content: [{ type: 'paragraph' }],
  type: 'doc',
};
