'use server';

import { and, eq, sql } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { requireProjectPermissionInTransaction } from '@/features/permissions/server/RevalidateProjectPermission';
import { extractPlainText } from '@/features/search/Search';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { updateDocumentSchema } from '../DocumentSchema';
import type { UpdateDocumentInput } from '../DocumentSchema';

export async function updateDocument(input: UpdateDocumentInput) {
  const { id: userId } = await requireUser();
  const documentInput = updateDocumentSchema.parse(input);
  const authorization = await authorizeDocument({
    documentId: documentInput.documentId,
    permission: 'document.update',
    userId,
  });

  const result = await db.transaction(async (transaction) => {
    const project = await requireProjectPermissionInTransaction({
      permission: 'document.update',
      projectId: authorization.document.projectId,
      transaction,
      userId,
    });
    const [lockedDocument] = await transaction
      .select({
        id: documentsSchema.id,
        kind: documentsSchema.kind,
        titleVersion: documentsSchema.titleVersion,
        updatedAt: documentsSchema.updatedAt,
      })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.id, documentInput.documentId),
          eq(documentsSchema.projectId, authorization.document.projectId),
        ),
      )
      .limit(1)
      .for('update', { of: documentsSchema });

    if (!lockedDocument) {
      throw new Error('文档保存失败');
    }

    if (documentInput.content !== undefined && lockedDocument.kind !== 'rich-text') {
      throw new Error('白板内容必须通过白板保存入口保存');
    }

    if (documentInput.content !== undefined && project.kind === 'team') {
      throw new Error('团队文档正文必须通过协作服务保存');
    }

    if (
      documentInput.expectedUpdatedAt !== undefined &&
      lockedDocument.updatedAt.getTime() !== documentInput.expectedUpdatedAt.getTime()
    ) {
      return { status: 'conflict' as const };
    }

    if (
      documentInput.expectedTitleVersion !== undefined &&
      lockedDocument.titleVersion !== documentInput.expectedTitleVersion
    ) {
      return { status: 'conflict' as const };
    }

    const [document] = await transaction
      .update(documentsSchema)
      .set({
        ...(documentInput.content === undefined
          ? {}
          : {
              content: documentInput.content,
              searchText: extractPlainText(documentInput.content),
            }),
        ...(documentInput.title === undefined
          ? {}
          : {
              title: documentInput.title,
              titleVersion: sql`${documentsSchema.titleVersion} + 1`,
            }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentsSchema.id, documentInput.documentId),
          eq(documentsSchema.projectId, authorization.document.projectId),
        ),
      )
      .returning({
        id: documentsSchema.id,
        titleVersion: documentsSchema.titleVersion,
        updatedAt: documentsSchema.updatedAt,
      });

    if (!document) {
      throw new Error('文档保存失败');
    }

    return {
      status: 'saved' as const,
      titleVersion: document.titleVersion,
      updatedAt: document.updatedAt,
    };
  });

  return result;
}
