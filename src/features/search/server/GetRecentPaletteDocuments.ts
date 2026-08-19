'use server';

import { and, eq, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';
import type { SearchResultItem } from '../Search';

const recentPaletteDocumentsSchema = z.object({
  documentIds: z.array(z.uuid()).max(10),
});

export type RecentPaletteDocumentsInput = z.infer<typeof recentPaletteDocumentsSchema>;

/**
 * Resolves recently accessed document IDs for the command palette, filtering out
 * deleted documents or documents where the user no longer has direct project access.
 *
 * @param input - Array of recent document IDs to verify and hydrate.
 * @returns Accessible search result items in the requested order.
 */
export async function getRecentPaletteDocuments(
  input: RecentPaletteDocumentsInput,
): Promise<SearchResultItem[]> {
  const { id: userId } = await requireUser();
  const { documentIds } = recentPaletteDocumentsSchema.parse(input);

  if (documentIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      documentId: documentsSchema.id,
      projectId: projectsSchema.id,
      projectName: projectsSchema.name,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
      workspaceId: workspacesSchema.id,
      workspaceKind: workspacesSchema.kind,
      workspaceName: workspacesSchema.name,
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
    .where(inArray(documentsSchema.id, documentIds));

  const rowsById = new Map(rows.map((row) => [row.documentId, row]));

  return documentIds.flatMap((documentId) => {
    const row = rowsById.get(documentId);
    if (!row) {
      return [];
    }

    return [
      {
        documentId: row.documentId,
        projectId: row.projectId,
        projectName: row.projectName,
        snippet: '',
        title: row.title,
        updatedAt: row.updatedAt,
        workspaceId: row.workspaceId,
        workspaceKind: row.workspaceKind,
        workspaceName: row.workspaceName,
      },
    ];
  });
}
