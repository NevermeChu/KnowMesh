import * as z from 'zod';
import type { DocumentContent } from '@/features/documents/Document';
import { isDocumentContent } from '@/features/documents/DocumentSchema';

export const readPersonalDocumentInputSchema = z.object({ documentId: z.uuid() }).strict();

export const writePersonalDocumentInputSchema = z
  .object({
    content: z.custom<DocumentContent>(isDocumentContent, '文档内容格式无效'),
    documentId: z.uuid(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
