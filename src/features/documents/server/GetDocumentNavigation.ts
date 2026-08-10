import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { documentsSchema, projectMembersSchema, projectsSchema } from '@/models/Schema';

/**
 * Returns document metadata for the authenticated workspace navigation.
 *
 * @param options - Active workspace boundary.
 * @returns The current member's accessible document navigation items.
 */
export async function getDocumentNavigation(options: { workspaceId: string }) {
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
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .innerJoin(projectMembersSchema, eq(projectMembersSchema.projectId, documentsSchema.projectId))
    .where(
      and(
        eq(projectMembersSchema.userId, userId),
        eq(projectsSchema.workspaceId, options.workspaceId),
      ),
    )
    .orderBy(desc(documentsSchema.updatedAt));
}
