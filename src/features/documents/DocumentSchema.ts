import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import * as z from 'zod';
import type {
  DocumentContent,
  DocumentMark,
  DocumentNode,
  JsonObject,
  JsonValue,
} from './Document';
import { documentKinds } from './Document';
import { documentExtensions } from './DocumentExtensions';

const prosemirrorSchema = getSchema(documentExtensions);

const MAX_DOCUMENT_JSON_CHARS = 512 * 1024;
const MAX_DOCUMENT_NODE_DEPTH = 100;

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown, depth: number): value is JsonValue => {
  if (depth > MAX_DOCUMENT_NODE_DEPTH) {
    return false;
  }

  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) {
    return typeof value !== 'number' || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }

  return false;
};

const isDocumentMark = (value: unknown, depth: number): value is DocumentMark => {
  if (!isJsonValue(value, depth) || !isJsonObject(value) || typeof value.type !== 'string') {
    return false;
  }

  return value.attrs === undefined || isJsonObject(value.attrs);
};

const isDocumentNode = (value: unknown, depth: number): value is DocumentNode => {
  if (depth > MAX_DOCUMENT_NODE_DEPTH) {
    return false;
  }

  if (!isJsonValue(value, depth) || !isJsonObject(value) || typeof value.type !== 'string') {
    return false;
  }

  const hasValidAttrs = value.attrs === undefined || isJsonObject(value.attrs);
  const hasValidContent =
    value.content === undefined ||
    (Array.isArray(value.content) &&
      value.content.every((item) => isDocumentNode(item, depth + 1)));
  const hasValidMarks =
    value.marks === undefined ||
    (Array.isArray(value.marks) && value.marks.every((item) => isDocumentMark(item, depth)));
  const hasValidText = value.text === undefined || typeof value.text === 'string';

  return hasValidAttrs && hasValidContent && hasValidMarks && hasValidText;
};

export const isDocumentContent = (value: unknown): value is DocumentContent => {
  const serialized = JSON.stringify(value);

  if (serialized === undefined || serialized.length > MAX_DOCUMENT_JSON_CHARS) {
    return false;
  }

  if (!isDocumentNode(value, 0) || value.type !== 'doc') {
    return false;
  }

  try {
    const documentNode = Node.fromJSON(prosemirrorSchema, value);
    documentNode.check();
    return true;
  } catch {
    return false;
  }
};

export const createDocumentSchema = z.object({
  kind: z.enum(documentKinds).default('rich-text'),
  parentId: z.uuid().optional(),
  projectId: z.uuid(),
  title: z.string().trim().min(1, '文件名不能为空').max(200, '文件名不能超过 200 个字符'),
});

export const deleteDocumentSchema = z.object({ documentId: z.uuid() });

export const documentNavigationChildrenSchema = z.object({
  cursor: z
    .object({
      id: z.uuid(),
      sortOrder: z.number(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
  parentId: z.uuid().nullable(),
  projectId: z.uuid(),
});

export const documentNavigationPathSchema = z.object({
  documentId: z.uuid(),
  projectId: z.uuid(),
});

export const moveDocumentSchema = z
  .object({
    documentId: z.uuid(),
    position: z.enum(['after', 'before', 'inside']).optional(),
    sortOrder: z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).optional(),
    targetDocumentId: z.uuid().optional(),
    targetParentId: z.uuid().nullable(),
    targetProjectId: z.uuid(),
  })
  .refine(
    (input) =>
      (input.position !== 'after' && input.position !== 'before') ||
      input.targetDocumentId !== undefined,
    { message: '相对移动缺少目标文档' },
  );

export const updateDocumentSchema = z
  .object({
    content: z.custom<DocumentContent>(isDocumentContent, '文档内容格式无效').optional(),
    documentId: z.uuid(),
    expectedTitleVersion: z.number().int().positive().optional(),
    expectedUpdatedAt: z.date().optional(),
    title: z
      .string()
      .trim()
      .min(1, '文档标题不能为空')
      .max(200, '文档标题不能超过 200 个字符')
      .optional(),
  })
  .refine((input) => input.content !== undefined || input.title !== undefined, {
    message: '没有需要保存的文档变更',
  })
  .refine((input) => input.content === undefined || input.expectedUpdatedAt !== undefined, {
    message: '保存文档正文时缺少版本信息',
  })
  .refine((input) => input.title === undefined || input.expectedTitleVersion !== undefined, {
    message: '保存文档标题时缺少版本信息',
  });

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>;
export type DocumentNavigationChildrenInput = z.input<typeof documentNavigationChildrenSchema>;
export type DocumentNavigationPathInput = z.infer<typeof documentNavigationPathSchema>;
export type MoveDocumentInput = z.infer<typeof moveDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
