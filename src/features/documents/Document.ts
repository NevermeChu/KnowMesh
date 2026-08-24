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
  breadcrumbs?: DocumentBreadcrumbItem[];
  content: DocumentContent;
  contentSchemaVersion: number;
  createdAt: Date;
  id: string;
  isStarred?: boolean;
  parentId: string | null;
  projectId: string;
  projectName?: string;
  sortOrder: number;
  title: string;
  updatedAt: Date;
};

export type DocumentNavigationItem = Pick<
  Document,
  'id' | 'parentId' | 'projectId' | 'sortOrder' | 'title'
>;

export type DocumentBreadcrumbItem = {
  href: string;
  id: string;
  title: string;
};

export const EMPTY_DOCUMENT_CONTENT: DocumentContent = {
  content: [{ type: 'paragraph' }],
  type: 'doc',
};
