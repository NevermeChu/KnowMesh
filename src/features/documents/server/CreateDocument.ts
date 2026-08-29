'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { requireProjectPermissionInTransaction } from '@/features/permissions/server/RevalidateProjectPermission';
import { EMPTY_WHITEBOARD_SCENE } from '@/features/whiteboards/WhiteboardScene';
import { db } from '@/libs/DB';
import { documentWhiteboardStatesSchema, documentsSchema } from '@/models/Schema';
import { createDocumentSchema } from '../DocumentSchema';
import type { CreateDocumentInput } from '../DocumentSchema';

export async function createDocument(input: CreateDocumentInput) {
  const { id: userId } = await requireUser();
  const documentInput = createDocumentSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'document.create',
    projectId: documentInput.projectId,
    userId,
  });

  const document = await db.transaction(async (transaction) => {
    await requireProjectPermissionInTransaction({
      permission: 'document.create',
      projectId: authorization.project.id,
      transaction,
      userId,
    });

    if (documentInput.parentId) {
      const [parentDocument] = await transaction
        .select({ id: documentsSchema.id })
        .from(documentsSchema)
        .where(
          and(
            eq(documentsSchema.id, documentInput.parentId),
            eq(documentsSchema.projectId, authorization.project.id),
          ),
        )
        .limit(1);

      if (!parentDocument) {
        throw new Error('指定的父文档不存在或不属于当前项目');
      }
    }

    const [latestSibling] = await transaction
      .select({ sortOrder: documentsSchema.sortOrder })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.projectId, authorization.project.id),
          documentInput.parentId
            ? eq(documentsSchema.parentId, documentInput.parentId)
            : isNull(documentsSchema.parentId),
        ),
      )
      .orderBy(desc(documentsSchema.sortOrder))
      .limit(1);

    const sortOrder = (latestSibling?.sortOrder ?? 0) + 1000;

    const [createdDocument] = await transaction
      .insert(documentsSchema)
      .values({
        createdById: userId,
        kind: documentInput.kind,
        parentId: documentInput.parentId ?? null,
        projectId: authorization.project.id,
        sortOrder,
        title: documentInput.title,
      })
      .returning({
        id: documentsSchema.id,
        kind: documentsSchema.kind,
        parentId: documentsSchema.parentId,
        projectId: documentsSchema.projectId,
        sortOrder: documentsSchema.sortOrder,
        title: documentsSchema.title,
      });

    if (createdDocument?.kind === 'whiteboard') {
      await transaction.insert(documentWhiteboardStatesSchema).values({
        documentId: createdDocument.id,
        scene: EMPTY_WHITEBOARD_SCENE,
      });
    }

    return createdDocument;
  });

  if (!document) {
    throw new Error('文档创建失败');
  }

  return document;
}
