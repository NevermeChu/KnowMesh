'use server';

import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { requireProjectPermissionInTransaction } from '@/features/permissions/server/RevalidateProjectPermission';
import { db } from '@/libs/DB';
import { documentCollaborationStatesSchema, documentsSchema } from '@/models/Schema';
import { moveDocumentSchema } from '../DocumentSchema';
import type { MoveDocumentInput } from '../DocumentSchema';
import { planDocumentSortOrder } from '../DocumentSortOrder';

const MAX_MOVED_SUBTREE_DOCUMENTS = 10_000;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function getRequestedSortOrder(options: {
  position?: 'after' | 'before' | 'inside';
  requestedSortOrder?: number;
  siblings: { id: string; sortOrder: number }[];
  targetDocumentId?: string;
}) {
  if (
    (options.position !== 'after' && options.position !== 'before') ||
    !options.targetDocumentId
  ) {
    return options.requestedSortOrder;
  }

  const targetIndex = options.siblings.findIndex(
    (sibling) => sibling.id === options.targetDocumentId,
  );
  if (targetIndex === -1) {
    throw new Error('指定的相对移动目标不存在于目标父节点');
  }

  const target = options.siblings[targetIndex];
  if (!target) {
    throw new Error('指定的相对移动目标不存在');
  }

  if (options.position === 'before') {
    const previous = options.siblings[targetIndex - 1];
    return previous ? (previous.sortOrder + target.sortOrder) / 2 : target.sortOrder - 1000;
  }

  const next = options.siblings[targetIndex + 1];
  return next ? (target.sortOrder + next.sortOrder) / 2 : target.sortOrder + 1000;
}

async function assertValidMoveTarget(options: {
  documentId: string;
  targetParentId: string | null;
  targetProjectId: string;
  transaction: Transaction;
}) {
  if (!options.targetParentId) {
    return;
  }

  const [targetParentDocument] = await options.transaction
    .select({
      id: documentsSchema.id,
      parentId: documentsSchema.parentId,
      projectId: documentsSchema.projectId,
    })
    .from(documentsSchema)
    .where(eq(documentsSchema.id, options.targetParentId))
    .limit(1)
    .for('update');

  if (!targetParentDocument) {
    throw new Error('指定的目标父文档不存在');
  }

  if (targetParentDocument.projectId !== options.targetProjectId) {
    throw new Error('目标父文档不属于目标项目');
  }

  let currentAncestorId: string | null = targetParentDocument.parentId;
  const visited = new Set<string>([targetParentDocument.id]);

  while (currentAncestorId) {
    if (currentAncestorId === options.documentId) {
      throw new Error('不能将文档移动到其子文档中');
    }

    if (visited.has(currentAncestorId)) {
      throw new Error('文档层级已存在循环');
    }

    visited.add(currentAncestorId);
    const [ancestor] = await options.transaction
      .select({ parentId: documentsSchema.parentId })
      .from(documentsSchema)
      .where(eq(documentsSchema.id, currentAncestorId))
      .limit(1)
      .for('update');
    currentAncestorId = ancestor?.parentId ?? null;
  }
}

async function getDescendantIds(
  transaction: Transaction,
  sourceProjectId: string,
  documentId: string,
) {
  const result = await transaction.execute<{ id: string }>(sql`
    with recursive move_subtree as (
      select
        documents.id,
        array[documents.id] as visited_ids
      from documents
      where documents.id = ${documentId}

      union all

      select
        child_documents.id,
        move_subtree.visited_ids || child_documents.id as visited_ids
      from documents as child_documents
        inner join move_subtree on child_documents.parent_id = move_subtree.id
      where
        child_documents.project_id = ${sourceProjectId}
        and child_documents.id <> all(move_subtree.visited_ids)
    )
    select id from move_subtree
    limit ${MAX_MOVED_SUBTREE_DOCUMENTS + 2}
  `);

  const descendantIds = result.rows.map((row) => row.id).filter((id) => id !== documentId);

  if (descendantIds.length > MAX_MOVED_SUBTREE_DOCUMENTS) {
    throw new Error('移动的文档子树规模超过限制');
  }

  return descendantIds;
}

/**
 * Moves a document to a new parent or project with cycle detection and subtree updates.
 *
 * @param input - The document id, target parent id, target project id, and optional sort order.
 * @returns The updated document hierarchy information.
 */
export async function moveDocument(input: MoveDocumentInput) {
  const { id: userId } = await requireUser();
  const documentInput = moveDocumentSchema.parse(input);

  const sourceAuthorization = await authorizeDocument({
    documentId: documentInput.documentId,
    permission: 'document.update',
    userId,
  });

  const isCrossProjectMove =
    documentInput.targetProjectId !== sourceAuthorization.document.projectId;

  if (isCrossProjectMove) {
    await authorizeProject({
      permission: 'document.create',
      projectId: documentInput.targetProjectId,
      userId,
    });
  }

  if (documentInput.targetParentId === documentInput.documentId) {
    throw new Error('不能将文档设置为自身的子文档');
  }

  const updatedDocument = await db.transaction(async (transaction) => {
    const sourceProject = await requireProjectPermissionInTransaction({
      permission: 'document.update',
      projectId: sourceAuthorization.document.projectId,
      transaction,
      userId,
    });

    let targetWorkspaceKind = sourceProject.kind;
    if (isCrossProjectMove) {
      const targetProject = await requireProjectPermissionInTransaction({
        permission: 'document.create',
        projectId: documentInput.targetProjectId,
        transaction,
        userId,
      });
      targetWorkspaceKind = targetProject.kind;
    }

    await assertValidMoveTarget({
      documentId: documentInput.documentId,
      targetParentId: documentInput.targetParentId,
      targetProjectId: documentInput.targetProjectId,
      transaction,
    });

    const siblings = await transaction
      .select({ id: documentsSchema.id, sortOrder: documentsSchema.sortOrder })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.projectId, documentInput.targetProjectId),
          ne(documentsSchema.id, documentInput.documentId),
          documentInput.targetParentId
            ? eq(documentsSchema.parentId, documentInput.targetParentId)
            : isNull(documentsSchema.parentId),
        ),
      )
      .orderBy(asc(documentsSchema.sortOrder))
      .for('update', { of: documentsSchema });

    const sortOrderPlan = planDocumentSortOrder({
      documentId: documentInput.documentId,
      requestedSortOrder: getRequestedSortOrder({
        position: documentInput.position,
        requestedSortOrder: documentInput.sortOrder,
        siblings,
        targetDocumentId: documentInput.targetDocumentId,
      }),
      siblings,
    });

    if (sortOrderPlan.updates.length > 0) {
      const rebalanceValues = sql.join(
        sortOrderPlan.updates.map(
          (sibling) => sql`(${sibling.id}::uuid, ${sibling.sortOrder}::double precision)`,
        ),
        sql`, `,
      );
      await transaction.execute(sql`
        update documents
        set sort_order = reorder.sort_order
        from (values ${rebalanceValues}) as reorder(id, sort_order)
        where documents.id = reorder.id
      `);
    }

    if (isCrossProjectMove) {
      const descendantIds = await getDescendantIds(
        transaction,
        sourceAuthorization.document.projectId,
        documentInput.documentId,
      );

      if (descendantIds.length > 0) {
        await transaction
          .update(documentsSchema)
          .set({ projectId: documentInput.targetProjectId, updatedAt: new Date() })
          .where(inArray(documentsSchema.id, descendantIds));
      }

      if (targetWorkspaceKind !== 'team') {
        await transaction
          .delete(documentCollaborationStatesSchema)
          .where(
            inArray(documentCollaborationStatesSchema.documentId, [
              documentInput.documentId,
              ...descendantIds,
            ]),
          );
      }
    }

    const [document] = await transaction
      .update(documentsSchema)
      .set({
        parentId: documentInput.targetParentId,
        projectId: documentInput.targetProjectId,
        sortOrder: sortOrderPlan.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(documentsSchema.id, documentInput.documentId))
      .returning({
        id: documentsSchema.id,
        parentId: documentsSchema.parentId,
        projectId: documentsSchema.projectId,
        sortOrder: documentsSchema.sortOrder,
        title: documentsSchema.title,
      });

    return document;
  });

  if (!updatedDocument) {
    throw new Error('文档移动失败');
  }

  revalidatePath('/(workspace)', 'layout');
  return updatedDocument;
}
