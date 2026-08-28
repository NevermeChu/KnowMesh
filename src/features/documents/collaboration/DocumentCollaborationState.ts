import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  documentCollaborationStatesSchema,
  documentsSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';
import { DOCUMENT_CONTENT_SCHEMA_VERSION } from '../Document';
import { isDocumentContent } from '../DocumentSchema';
import {
  documentContentToYDoc,
  encodeDocumentCollaborationState,
} from './DocumentCollaborationTransform';

export async function getOrInitializeDocumentCollaborationState(documentId: string) {
  return await db.transaction(async (transaction) => {
    const [document] = await transaction
      .select({
        content: documentsSchema.content,
        contentSchemaVersion: documentsSchema.contentSchemaVersion,
        kind: documentsSchema.kind,
        workspaceKind: workspacesSchema.kind,
      })
      .from(documentsSchema)
      .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
      .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
      .where(eq(documentsSchema.id, documentId))
      .limit(1)
      .for('update', { of: documentsSchema });

    if (!document) {
      throw new Error('文档不存在');
    }

    if (document.workspaceKind !== 'team') {
      throw new Error('个人空间文档不支持协作状态');
    }

    if (document.kind !== 'rich-text') {
      throw new Error('白板文档不支持富文本协作状态');
    }

    const [existingState] = await transaction
      .select()
      .from(documentCollaborationStatesSchema)
      .where(eq(documentCollaborationStatesSchema.documentId, documentId))
      .limit(1);

    if (existingState) {
      if (existingState.documentSchemaVersion !== DOCUMENT_CONTENT_SCHEMA_VERSION) {
        throw new Error('协作文档状态版本不兼容');
      }
      return existingState;
    }

    if (
      document.contentSchemaVersion !== DOCUMENT_CONTENT_SCHEMA_VERSION ||
      !isDocumentContent(document.content)
    ) {
      throw new Error('文档正文版本无法初始化协作状态');
    }

    const state = encodeDocumentCollaborationState(documentContentToYDoc(document.content));

    await transaction
      .insert(documentCollaborationStatesSchema)
      .values({
        documentId,
        documentSchemaVersion: DOCUMENT_CONTENT_SCHEMA_VERSION,
        state,
      })
      .onConflictDoNothing({ target: documentCollaborationStatesSchema.documentId });

    const [collaborationState] = await transaction
      .select()
      .from(documentCollaborationStatesSchema)
      .where(eq(documentCollaborationStatesSchema.documentId, documentId))
      .limit(1);

    if (!collaborationState) {
      throw new Error('协作文档状态初始化失败');
    }

    return collaborationState;
  });
}
