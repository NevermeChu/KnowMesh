'use server';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import * as z from 'zod';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspacesSchema,
} from '@/models/Schema';
import { escapeSqlLikePattern } from '@/utils/SqlPattern';
import { searchFilters } from '../Search';
import type { SearchFilter, SearchResults } from '../Search';

const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_QUERY_CHARS = 200;
const SNIPPET_MAX_LENGTH = 140;
const SNIPPET_LEAD_LENGTH = Math.floor(SNIPPET_MAX_LENGTH / 3);
const SNIPPET_TRIM_CHARS = '\t\n\r ';

const searchWorkspaceOptionsSchema = z.object({
  filter: z.enum(searchFilters).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  query: z.string().trim().max(MAX_SEARCH_QUERY_CHARS),
});

export type SearchWorkspaceOptions = {
  filter?: SearchFilter;
  page?: number;
  pageSize?: number;
  query: string;
};

/**
 * Searches documents across user's accessible projects and workspaces by matching
 * title or document plain text content, sorted with weighted relevance scoring and pagination.
 *
 * @param options - Search keyword, optional workspace filter, page, and pageSize.
 * @returns Filtered and sorted search results with contextual snippets and pagination metadata.
 */
export async function searchWorkspaceContent(
  options: SearchWorkspaceOptions,
): Promise<SearchResults> {
  const { id: userId } = await requireUser();
  const searchOptions = searchWorkspaceOptionsSchema.parse(options);
  const trimmedQuery = searchOptions.query;
  const page = searchOptions.page ?? 1;
  const pageSize = searchOptions.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  if (!trimmedQuery) {
    return {
      hasMore: false,
      items: [],
      page,
      pageSize,
      totalCount: 0,
      totalPages: 0,
    };
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

  if (searchOptions.filter === 'personal') {
    whereConditions.push(eq(workspacesSchema.kind, 'personal'));
  } else if (searchOptions.filter === 'team') {
    whereConditions.push(eq(workspacesSchema.kind, 'team'));
  }

  const scoreSql = sql<number>`
    CASE
      WHEN ${documentsSchema.title} ilike ${escapedQuery} THEN 100
      WHEN ${documentsSchema.title} ilike ${searchPattern} THEN 50
      ELSE 10
    END
  `;

  const matchPositionSql = sql<number>`position(lower(${trimmedQuery}) in lower(${documentsSchema.searchText}))`;
  const textLengthSql = sql<number>`char_length(${documentsSchema.searchText})`;
  const snippetStartSql = sql<number>`greatest(1, ${matchPositionSql} - ${SNIPPET_LEAD_LENGTH})`;
  const snippetWindowSql = sql<number>`least(${textLengthSql} - ${snippetStartSql} + 1, ${SNIPPET_MAX_LENGTH})`;

  const snippetSql = sql<string>`
    CASE
      WHEN ${documentsSchema.searchText} = '' THEN ''
      WHEN ${matchPositionSql} = 0 THEN
        CASE
          WHEN ${textLengthSql} > ${SNIPPET_MAX_LENGTH}
            THEN btrim(substring(${documentsSchema.searchText} for ${SNIPPET_MAX_LENGTH}), ${SNIPPET_TRIM_CHARS}) || '…'
          ELSE ${documentsSchema.searchText}
        END
      ELSE
        CASE WHEN ${snippetStartSql} > 1 THEN '…' ELSE '' END
        || btrim(
          substring(${documentsSchema.searchText} from ${snippetStartSql} for ${snippetWindowSql}),
          ${SNIPPET_TRIM_CHARS}
        )
        || CASE WHEN ${snippetStartSql} - 1 + ${snippetWindowSql} < ${textLengthSql} THEN '…' ELSE '' END
    END
  `;

  const [countRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
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
    .where(and(...whereConditions));

  const totalCount = countRow?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalCount === 0 || offset >= totalCount) {
    return {
      hasMore: false,
      items: [],
      page,
      pageSize,
      totalCount,
      totalPages,
    };
  }

  const rows = await db
    .select({
      documentId: documentsSchema.id,
      projectId: projectsSchema.id,
      projectName: projectsSchema.name,
      snippet: snippetSql,
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
    .orderBy(desc(scoreSql), desc(documentsSchema.updatedAt), desc(documentsSchema.id))
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((row) => ({
    documentId: row.documentId,
    projectId: row.projectId,
    projectName: row.projectName,
    snippet: row.snippet,
    title: row.title,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
    workspaceKind: row.workspaceKind,
    workspaceName: row.workspaceName,
  }));

  return {
    hasMore: offset + items.length < totalCount,
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}
