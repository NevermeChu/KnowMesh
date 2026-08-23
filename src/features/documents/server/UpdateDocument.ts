'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { db } from '@/libs/DB';
import { documentsSchema, projectsSchema, workspacesSchema } from '@/models/Schema';
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

  await db.transaction(async (transaction) => {
    const [documentMode] = await transaction
      .select({
        workspaceKind: workspacesSchema.kind,
      })
      .from(documentsSchema)
      .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
      .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
      .where(
        and(
          eq(documentsSchema.id, documentInput.documentId),
          eq(documentsSchema.projectId, authorization.document.projectId),
        ),
      )
      .limit(1)
      .for('update', { of: documentsSchema });

    if (!documentMode) {
      throw new Error('文档保存失败');
    }

    if (documentInput.content !== undefined && documentMode.workspaceKind === 'team') {
      throw new Error('团队文档正文必须通过协作服务保存');
    }

    const [document] = await transaction
      .update(documentsSchema)
      .set({
        ...(documentInput.content === undefined ? {} : { content: documentInput.content }),
        ...(documentInput.title === undefined ? {} : { title: documentInput.title }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentsSchema.id, documentInput.documentId),
          eq(documentsSchema.projectId, authorization.document.projectId),
        ),
      )
      .returning({ id: documentsSchema.id });

    if (!document) {
      throw new Error('文档保存失败');
    }
  });

  if (documentInput.title !== undefined) {
    revalidatePath('/(workspace)', 'layout');
  }
}
