'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { createDocumentSchema } from '../DocumentSchema';
import type { CreateDocumentInput } from '../DocumentSchema';

export async function createDocument(input: CreateDocumentInput) {
  const { userId } = await auth.protect();
  const documentInput = createDocumentSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'document.create',
    projectId: documentInput.projectId,
    userId,
  });

  const [document] = await db
    .insert(documentsSchema)
    .values({
      createdById: userId,
      projectId: authorization.project.id,
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
