import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';

export type RecentDocumentItem = {
  documentId: string;
  projectId: string;
  projectName: string;
  title: string;
  updatedAt: Date;
  workspaceKind: 'personal' | 'team';
};

/**
 * Reads the most recently updated documents the current user can open, scoped to
 * direct project membership so workspace-level structure access stays excluded.
 *
 * @param limit - Maximum number of documents to return.
 * @returns Recently updated documents with their project and workspace context.
 */
export const getRecentDocuments = cache(async (limit = 8): Promise<RecentDocumentItem[]> => {
  const { userId } = await auth.protect();

  return await db
    .select({
      documentId: documentsSchema.id,
      projectId: projectsSchema.id,
      projectName: projectsSchema.name,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
      workspaceKind: workspacesSchema.kind,
    })
    .from(documentsSchema)
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .innerJoin(
      projectMembersSchema,
      and(
        eq(projectMembersSchema.projectId, projectsSchema.id),
        eq(projectMembersSchema.userId, userId),
      ),
    )
    .orderBy(desc(documentsSchema.updatedAt))
    .limit(limit);
});
