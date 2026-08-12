'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { updateDocumentSchema } from '../DocumentSchema';
import type { UpdateDocumentInput } from '../DocumentSchema';

export async function updateDocument(input: UpdateDocumentInput) {
  const { userId } = await auth.protect();
  const documentInput = updateDocumentSchema.parse(input);
  const authorization = await authorizeDocument({
    documentId: documentInput.documentId,
    permission: 'document.update',
    userId,
  });

  const [document] = await db
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
    .returning({
      id: documentsSchema.id,
      updatedAt: documentsSchema.updatedAt,
    });

  if (!document) {
    throw new Error('文档保存失败');
  }

  return document;
}
