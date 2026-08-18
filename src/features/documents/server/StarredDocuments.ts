'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  starredDocumentsSchema,
  workspacesSchema,
} from '@/models/Schema';

export type StarredDocumentItem = {
  documentId: string;
  projectId: string;
  projectName: string;
  starredAt: Date;
  title: string;
  updatedAt: Date;
  workspaceKind: 'personal' | 'team';
};

const documentIdSchema = z.object({
  documentId: z.uuid(),
});

/**
 * Reads all documents starred by the authenticated user that they still have permission to read.
 *
 * @returns Starred documents sorted by star timestamp descending.
 */
export async function getStarredDocuments(): Promise<StarredDocumentItem[]> {
  const { id: userId } = await requireUser();

  return await db
    .select({
      documentId: documentsSchema.id,
      projectId: projectsSchema.id,
      projectName: projectsSchema.name,
      starredAt: starredDocumentsSchema.createdAt,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
      workspaceKind: workspacesSchema.kind,
    })
    .from(starredDocumentsSchema)
    .innerJoin(documentsSchema, eq(documentsSchema.id, starredDocumentsSchema.documentId))
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .innerJoin(
      projectMembersSchema,
      and(
        eq(projectMembersSchema.projectId, projectsSchema.id),
        eq(projectMembersSchema.userId, userId),
      ),
    )
    .where(eq(starredDocumentsSchema.userId, userId))
    .orderBy(desc(starredDocumentsSchema.createdAt));
}

/**
 * Checks whether a document is starred by the current user.
 *
 * @param input - The document id.
 * @returns True if starred, false otherwise.
 */
export async function getIsDocumentStarred(input: { documentId: string }): Promise<boolean> {
  const { id: userId } = await requireUser();
  const { documentId } = documentIdSchema.parse(input);

  const [row] = await db
    .select({ documentId: starredDocumentsSchema.documentId })
    .from(starredDocumentsSchema)
    .where(
      and(
        eq(starredDocumentsSchema.userId, userId),
        eq(starredDocumentsSchema.documentId, documentId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Toggles the starred status of a document for the authenticated user.
 *
 * @param input - Target document identifier.
 * @returns The new star status.
 */
export async function toggleStarredDocument(input: {
  documentId: string;
}): Promise<{ isStarred: boolean }> {
  const { id: userId } = await requireUser();
  const { documentId } = documentIdSchema.parse(input);

  await authorizeDocument({
    documentId,
    permission: 'document.read',
    userId,
  });

  const [existing] = await db
    .select({ documentId: starredDocumentsSchema.documentId })
    .from(starredDocumentsSchema)
    .where(
      and(
        eq(starredDocumentsSchema.userId, userId),
        eq(starredDocumentsSchema.documentId, documentId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(starredDocumentsSchema)
      .where(
        and(
          eq(starredDocumentsSchema.userId, userId),
          eq(starredDocumentsSchema.documentId, documentId),
        ),
      );

    revalidatePath('/starred');
    return { isStarred: false };
  }

  await db.insert(starredDocumentsSchema).values({
    documentId,
    userId,
  });

  revalidatePath('/starred');
  return { isStarred: true };
}
