import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { documentsSchema, projectMembersSchema } from '@/models/Schema';

/**
 * Returns document metadata for the authenticated workspace navigation.
 *
 * @returns The current member's accessible document navigation items.
 */
export async function getDocumentNavigation() {
  const { userId } = await auth.protect();

  return await db
    .select({
      createdAt: documentsSchema.createdAt,
      id: documentsSchema.id,
      projectId: documentsSchema.projectId,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
    })
    .from(documentsSchema)
    .innerJoin(projectMembersSchema, eq(projectMembersSchema.projectId, documentsSchema.projectId))
    .where(eq(projectMembersSchema.userId, userId))
    .orderBy(desc(documentsSchema.updatedAt));
}
