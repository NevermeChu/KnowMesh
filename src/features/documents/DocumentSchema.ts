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
import { documentExtensions } from './DocumentExtensions';

const prosemirrorSchema = getSchema(documentExtensions);

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) {
    return typeof value !== 'number' || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue);
  }

  return false;
};

const isDocumentMark = (value: unknown): value is DocumentMark => {
  if (!isJsonValue(value) || !isJsonObject(value) || typeof value.type !== 'string') {
    return false;
  }

  return value.attrs === undefined || isJsonObject(value.attrs);
};

const isDocumentNode = (value: unknown): value is DocumentNode => {
  if (!isJsonValue(value) || !isJsonObject(value) || typeof value.type !== 'string') {
    return false;
  }

  const hasValidAttrs = value.attrs === undefined || isJsonObject(value.attrs);
  const hasValidContent =
    value.content === undefined ||
    (Array.isArray(value.content) && value.content.every(isDocumentNode));
  const hasValidMarks =
    value.marks === undefined || (Array.isArray(value.marks) && value.marks.every(isDocumentMark));
  const hasValidText = value.text === undefined || typeof value.text === 'string';

  return hasValidAttrs && hasValidContent && hasValidMarks && hasValidText;
};

export const isDocumentContent = (value: unknown): value is DocumentContent => {
  if (!isDocumentNode(value) || value.type !== 'doc') {
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
  projectId: z.uuid(),
  title: z.string().trim().min(1, '文件名不能为空').max(200, '文件名不能超过 200 个字符'),
});

export const updateDocumentSchema = z
  .object({
    content: z.custom<DocumentContent>(isDocumentContent, '文档内容格式无效').optional(),
    documentId: z.uuid(),
    title: z
      .string()
      .trim()
      .min(1, '文档标题不能为空')
      .max(200, '文档标题不能超过 200 个字符')
      .optional(),
  })
  .refine((input) => input.content !== undefined || input.title !== undefined, {
    message: '没有需要保存的文档变更',
  });

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
