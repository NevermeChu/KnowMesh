import { and, eq } from 'drizzle-orm';
import type * as Y from 'yjs';
import { db } from '@/libs/DB';
import { documentCollaborationStatesSchema, documentsSchema } from '@/models/Schema';
import { DOCUMENT_CONTENT_SCHEMA_VERSION } from '../Document';
import { getOrInitializeDocumentCollaborationState } from './DocumentCollaborationState';
import {
  decodeDocumentCollaborationState,
  encodeDocumentCollaborationState,
  repairLegacyDocumentCollaborationField,
  yDocToDocumentContent,
} from './DocumentCollaborationTransform';

export async function loadDocumentCollaborationState(documentId: string) {
  const collaborationState = await getOrInitializeDocumentCollaborationState(documentId);
  return repairLegacyDocumentCollaborationField(
    decodeDocumentCollaborationState(collaborationState.state),
  );
}

export async function persistDocumentCollaborationState(options: {
  document: Y.Doc;
  documentId: string;
}) {
  const content = yDocToDocumentContent(options.document);
  const state = encodeDocumentCollaborationState(options.document);
  const updatedAt = new Date();

  await db.transaction(async (transaction) => {
    const [storedState] = await transaction
      .update(documentCollaborationStatesSchema)
      .set({
        documentSchemaVersion: DOCUMENT_CONTENT_SCHEMA_VERSION,
        state,
        updatedAt,
      })
      .where(
        and(
          eq(documentCollaborationStatesSchema.documentId, options.documentId),
          eq(
            documentCollaborationStatesSchema.documentSchemaVersion,
            DOCUMENT_CONTENT_SCHEMA_VERSION,
          ),
        ),
      )
      .returning({ documentId: documentCollaborationStatesSchema.documentId });

    if (!storedState) {
      throw new Error('协作文档状态不存在或版本不兼容');
    }

    const [projectedDocument] = await transaction
      .update(documentsSchema)
      .set({
        content,
        contentSchemaVersion: DOCUMENT_CONTENT_SCHEMA_VERSION,
        updatedAt,
      })
      .where(
        and(
          eq(documentsSchema.id, options.documentId),
          eq(documentsSchema.contentSchemaVersion, DOCUMENT_CONTENT_SCHEMA_VERSION),
        ),
      )
      .returning({ id: documentsSchema.id });

    if (!projectedDocument) {
      throw new Error('协作文档正文投影失败');
    }
  });
}
