import * as z from 'zod';

const documentCollaborationTitleMessageSchema = z.object({
  documentId: z.uuid(),
  title: z.string().min(1).max(200),
  titleVersion: z.number().int().positive(),
  type: z.literal('document-title'),
});

export type DocumentCollaborationTitleMessage = z.infer<
  typeof documentCollaborationTitleMessageSchema
>;

export function createDocumentCollaborationTitleMessage(
  message: Omit<DocumentCollaborationTitleMessage, 'type'>,
) {
  return JSON.stringify({ ...message, type: 'document-title' });
}

export function parseDocumentCollaborationTitleMessage(payload: string) {
  try {
    const result = documentCollaborationTitleMessageSchema.safeParse(JSON.parse(payload));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
