'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { canEditDocuments } from '../Document';
import { updateDocumentSchema } from '../DocumentSchema';
import type { UpdateDocumentInput } from '../DocumentSchema';
import { getDocumentAccess } from './DocumentAccess';

export async function updateDocument(input: UpdateDocumentInput) {
  const { userId } = await auth.protect();
  const documentInput = updateDocumentSchema.parse(input);
  const access = await getDocumentAccess({ documentId: documentInput.documentId, userId });

  if (!access || !canEditDocuments(access.role)) {
    throw new Error('没有权限编辑该文档');
  }

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
        eq(documentsSchema.projectId, access.projectId),
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
