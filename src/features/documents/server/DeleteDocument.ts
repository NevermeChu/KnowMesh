'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { deleteDocumentSchema } from '../DocumentSchema';
import type { DeleteDocumentInput } from '../DocumentSchema';

export async function deleteDocument(input: DeleteDocumentInput) {
  const { id: userId } = await requireUser();
  const documentInput = deleteDocumentSchema.parse(input);
  const authorization = await authorizeDocument({
    documentId: documentInput.documentId,
    permission: 'document.delete',
    userId,
  });
  const [document] = await db
    .delete(documentsSchema)
    .where(
      and(
        eq(documentsSchema.id, authorization.document.id),
        eq(documentsSchema.projectId, authorization.document.projectId),
      ),
    )
    .returning({ id: documentsSchema.id, projectId: documentsSchema.projectId });

  if (!document) {
    throw new Error('文件删除失败');
  }

  revalidatePath('/(workspace)', 'layout');
}
