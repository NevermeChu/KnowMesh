'use server';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';
import { escapeSqlLikePattern } from '@/utils/SqlPattern';
import { extractSnippet } from '../Search';
import type { SearchFilter, SearchResultItem } from '../Search';

export type SearchWorkspaceOptions = {
  filter?: SearchFilter;
  query: string;
};

/**
 * Searches documents across user's accessible projects and workspaces by matching
 * title or document plain text content, sorted with weighted relevance scoring.
 *
 * @param options - Search keyword and optional workspace filter.
 * @returns Filtered and sorted search results with contextual snippets.
 */
export async function searchWorkspaceContent(
  options: SearchWorkspaceOptions,
): Promise<SearchResultItem[]> {
  const { id: userId } = await requireUser();
  const trimmedQuery = options.query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const escapedQuery = escapeSqlLikePattern(trimmedQuery);
  const searchPattern = `%${escapedQuery}%`;

  const whereConditions = [
    eq(projectMembersSchema.userId, userId),
    or(
      ilike(documentsSchema.title, searchPattern),
      ilike(documentsSchema.searchText, searchPattern),
    ),
  ];

  if (options.filter === 'personal') {
    whereConditions.push(eq(workspacesSchema.kind, 'personal'));
  } else if (options.filter === 'team') {
    whereConditions.push(eq(workspacesSchema.kind, 'team'));
  }

  const scoreSql = sql<number>`
    CASE
      WHEN ${documentsSchema.title} ilike ${escapedQuery} THEN 100
      WHEN ${documentsSchema.title} ilike ${searchPattern} THEN 50
      ELSE 10
    END
  `;

  const rows = await db
    .select({
      documentId: documentsSchema.id,
      projectId: projectsSchema.id,
      projectName: projectsSchema.name,
      searchText: documentsSchema.searchText,
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

  return rows.map((row) => ({
    documentId: row.documentId,
    projectId: row.projectId,
    projectName: row.projectName,
    snippet: extractSnippet(row.searchText, trimmedQuery),
    title: row.title,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
    workspaceKind: row.workspaceKind,
    workspaceName: row.workspaceName,
  }));
}
