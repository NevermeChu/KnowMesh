'use server';

import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import type { DocumentNavigationItem, DocumentNavigationPage } from '../Document';
import { documentNavigationChildrenSchema, documentNavigationPathSchema } from '../DocumentSchema';
import type {
  DocumentNavigationChildrenInput,
  DocumentNavigationPathInput,
} from '../DocumentSchema';

const MAX_DOCUMENT_NAVIGATION_DEPTH = 100;

type DocumentPathRow = {
  depth: number;
  id: string;
  parentId: string | null;
  projectId: string;
  sortOrder: number;
  title: string;
};

async function requireNavigationAccess(projectId: string) {
  const { id: userId } = await requireUser();
  return await authorizeProject({
    permission: 'project.structure.read',
    projectId,
    userId,
  });
}

async function addHasChildren(items: Omit<DocumentNavigationItem, 'hasChildren'>[]) {
  if (items.length === 0) {
    return [];
  }

  const childRows = await db
    .select({ parentId: documentsSchema.parentId })
    .from(documentsSchema)
    .where(
      inArray(
        documentsSchema.parentId,
        items.map((item) => item.id),
      ),
    )
    .groupBy(documentsSchema.parentId);
  const parentIds = new Set(childRows.flatMap((child) => (child.parentId ? [child.parentId] : [])));

  return items.map((item) => ({ ...item, hasChildren: parentIds.has(item.id) }));
}

/**
 * Loads one stable page of direct children for a project or document node.
 *
 * @param input - Project, parent, cursor, and bounded page size.
 * @returns Direct navigation children and the next stable cursor.
 */
export async function getDocumentNavigationChildren(
  input: DocumentNavigationChildrenInput,
): Promise<DocumentNavigationPage> {
  const options = documentNavigationChildrenSchema.parse(input);
  await requireNavigationAccess(options.projectId);

  if (options.parentId) {
    const [parent] = await db
      .select({ id: documentsSchema.id })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.id, options.parentId),
          eq(documentsSchema.projectId, options.projectId),
        ),
      )
      .limit(1);

    if (!parent) {
      throw new Error('指定的导航父文档不存在或不属于当前项目');
    }
  }

  const rows = await db
    .select({
      id: documentsSchema.id,
      parentId: documentsSchema.parentId,
      projectId: documentsSchema.projectId,
      sortOrder: documentsSchema.sortOrder,
      title: documentsSchema.title,
    })
    .from(documentsSchema)
    .where(
      and(
        eq(documentsSchema.projectId, options.projectId),
        options.parentId
          ? eq(documentsSchema.parentId, options.parentId)
          : isNull(documentsSchema.parentId),
        options.cursor
          ? or(
              gt(documentsSchema.sortOrder, options.cursor.sortOrder),
              and(
                eq(documentsSchema.sortOrder, options.cursor.sortOrder),
                gt(documentsSchema.id, options.cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(documentsSchema.sortOrder), asc(documentsSchema.id))
    .limit(options.limit + 1);
  const pageRows = rows.slice(0, options.limit);
  const items = await addHasChildren(pageRows);
  const lastItem = pageRows.at(-1);

  return {
    items,
    nextCursor:
      rows.length > options.limit && lastItem
        ? { id: lastItem.id, sortOrder: lastItem.sortOrder }
        : null,
  };
}

/**
 * Loads the selected document's bounded ancestor chain for direct navigation.
 *
 * @param input - Selected project and document ids.
 * @returns Root-to-selected navigation items, or null when the document is outside the project.
 */
export async function getDocumentNavigationPath(
  input: DocumentNavigationPathInput,
): Promise<DocumentNavigationItem[] | null> {
  const options = documentNavigationPathSchema.parse(input);
  await requireNavigationAccess(options.projectId);

  const result = await db.execute<DocumentPathRow>(sql`
    with recursive navigation_path as (
      select
        documents.id,
        documents.parent_id as "parentId",
        documents.project_id as "projectId",
        documents.sort_order as "sortOrder",
        documents.title,
        1 as depth,
        array[documents.id] as visited_ids
      from documents
      where documents.id = ${options.documentId}
        and documents.project_id = ${options.projectId}

      union all

      select
        ancestor.id,
        ancestor.parent_id as "parentId",
        ancestor.project_id as "projectId",
        ancestor.sort_order as "sortOrder",
        ancestor.title,
        navigation_path.depth + 1 as depth,
        navigation_path.visited_ids || ancestor.id as visited_ids
      from documents as ancestor
        inner join navigation_path on ancestor.id = navigation_path."parentId"
      where
        ancestor.project_id = ${options.projectId}
        and ancestor.id <> all(navigation_path.visited_ids)
        and navigation_path.depth <= ${MAX_DOCUMENT_NAVIGATION_DEPTH}
    )
    select id, "parentId", "projectId", "sortOrder", title, depth
    from navigation_path
    order by depth desc
  `);

  const [topmostAncestor] = result.rows;
  if (!topmostAncestor) {
    return null;
  }

  const reachedIds = new Set(result.rows.map((row) => row.id));
  const isCyclic = topmostAncestor.parentId !== null && reachedIds.has(topmostAncestor.parentId);
  if (isCyclic || result.rows.length > MAX_DOCUMENT_NAVIGATION_DEPTH) {
    throw new Error('文档导航层级存在循环或超过最大深度');
  }

  if (topmostAncestor.parentId !== null) {
    return null;
  }

  const path = result.rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    projectId: row.projectId,
    sortOrder: row.sortOrder,
    title: row.title,
  }));
  const selectedWithChildren = await addHasChildren(path.slice(-1));

  return path.map((document, index) => ({
    ...document,
    hasChildren: index < path.length - 1 || selectedWithChildren.at(0)?.hasChildren === true,
  }));
}
