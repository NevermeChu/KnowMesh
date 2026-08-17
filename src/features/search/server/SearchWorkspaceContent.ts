'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';
import { extractPlainText, extractSnippet } from '../Search';
import type { SearchFilter, SearchResultItem } from '../Search';

export type SearchWorkspaceOptions = {
  filter?: SearchFilter;
  query: string;
};

/**
 * Searches documents across user's accessible projects and workspaces by matching
 * title or document content, sorted with weighted relevance scoring.
 *
 * @param options - Search keyword and optional workspace filter.
 * @returns Filtered and sorted search results with contextual snippets.
 */
export async function searchWorkspaceContent(
  options: SearchWorkspaceOptions,
): Promise<SearchResultItem[]> {
  const { userId } = await auth.protect();
  const trimmedQuery = options.query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const searchPattern = `%${trimmedQuery}%`;

  const whereConditions = [
    eq(projectMembersSchema.userId, userId),
    or(
      ilike(documentsSchema.title, searchPattern),
      sql`${documentsSchema.content}::text ilike ${searchPattern}`,
    ),
  ];

  if (options.filter === 'personal') {
    whereConditions.push(eq(workspacesSchema.kind, 'personal'));
  } else if (options.filter === 'team') {
    whereConditions.push(eq(workspacesSchema.kind, 'team'));
  }

  const scoreSql = sql<number>`
    CASE
      WHEN ${documentsSchema.title} ilike ${trimmedQuery} THEN 100
      WHEN ${documentsSchema.title} ilike ${searchPattern} THEN 50
      ELSE 10
    END
  `;

  const rows = await db
    .select({
      content: documentsSchema.content,
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
    .where(and(...whereConditions))
    .orderBy(desc(scoreSql), desc(documentsSchema.updatedAt))
    .limit(30);

  return rows.map((row) => {
    const plainText = extractPlainText(row.content);
    const snippet = extractSnippet(plainText, trimmedQuery);

    return {
      documentId: row.documentId,
      projectId: row.projectId,
      projectName: row.projectName,
      snippet,
      title: row.title,
      updatedAt: row.updatedAt,
      workspaceId: row.workspaceId,
      workspaceKind: row.workspaceKind,
      workspaceName: row.workspaceName,
    };
  });
}
