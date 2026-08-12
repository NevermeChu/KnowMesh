export const DOCUMENT_CONTENT_SCHEMA_VERSION = 1;

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
  projectId: string;
  title: string;
  updatedAt: Date;
};

export type DocumentNavigationItem = Pick<Document, 'id' | 'projectId' | 'title'>;

export const EMPTY_DOCUMENT_CONTENT: DocumentContent = {
  content: [{ type: 'paragraph' }],
  type: 'doc',
};
