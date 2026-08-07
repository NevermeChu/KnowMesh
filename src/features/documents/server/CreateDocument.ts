'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { canEditDocuments } from '../Document';
import { createDocumentSchema } from '../DocumentSchema';
import type { CreateDocumentInput } from '../DocumentSchema';
import { getProjectAccess } from './DocumentAccess';

export async function createDocument(input: CreateDocumentInput) {
  const { userId } = await auth.protect();
  const documentInput = createDocumentSchema.parse(input);
  const access = await getProjectAccess({ projectId: documentInput.projectId, userId });

  if (!access || !canEditDocuments(access.role)) {
    throw new Error('没有权限在该项目中创建文档');
  }

  const [document] = await db
    .insert(documentsSchema)
    .values({
      createdById: userId,
      projectId: documentInput.projectId,
      title: documentInput.title,
    })
    .returning({
      id: documentsSchema.id,
      projectId: documentsSchema.projectId,
      title: documentsSchema.title,
    });

  if (!document) {
    throw new Error('文档创建失败');
  }

  revalidatePath('/(workspace)', 'layout');
  return document;
}
