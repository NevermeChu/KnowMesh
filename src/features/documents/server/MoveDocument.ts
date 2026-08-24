'use server';

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { requireProjectPermissionInTransaction } from '@/features/permissions/server/RevalidateProjectPermission';
import { db } from '@/libs/DB';
import { documentCollaborationStatesSchema, documentsSchema } from '@/models/Schema';
import { moveDocumentSchema } from '../DocumentSchema';
import type { MoveDocumentInput } from '../DocumentSchema';

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

  let targetAuthorization = null;
  if (isCrossProjectMove) {
    targetAuthorization = await authorizeProject({
      permission: 'document.create',
      projectId: documentInput.targetProjectId,
      userId,
    });
  }

  const targetWorkspaceKind =
    targetAuthorization?.project.workspaceKind ?? sourceAuthorization.project.workspaceKind;

  if (documentInput.targetParentId) {
    if (documentInput.targetParentId === documentInput.documentId) {
      throw new Error('不能将文档设置为自身的子文档');
    }

    const [targetParentDocument] = await db
      .select({
        id: documentsSchema.id,
        parentId: documentsSchema.parentId,
        projectId: documentsSchema.projectId,
      })
      .from(documentsSchema)
      .where(eq(documentsSchema.id, documentInput.targetParentId))
      .limit(1);

    if (!targetParentDocument) {
      throw new Error('指定的目标父文档不存在');
    }

    if (targetParentDocument.projectId !== documentInput.targetProjectId) {
      throw new Error('目标父文档不属于目标项目');
    }

    // Cycle detection: walk up the ancestor chain of targetParentDocument
    let currentAncestorId: string | null = targetParentDocument.parentId;
    const visited = new Set<string>([targetParentDocument.id]);

    while (currentAncestorId) {
      if (currentAncestorId === documentInput.documentId) {
        throw new Error('不能将文档移动到其子文档中');
      }

      if (visited.has(currentAncestorId)) {
        break;
      }

      visited.add(currentAncestorId);

      const [ancestor] = await db
        .select({ parentId: documentsSchema.parentId })
        .from(documentsSchema)
        .where(eq(documentsSchema.id, currentAncestorId))
        .limit(1);

      currentAncestorId = ancestor?.parentId ?? null;
    }
  }

  let finalSortOrder = documentInput.sortOrder;

  if (finalSortOrder === undefined) {
    const [latestSibling] = await db
      .select({ sortOrder: documentsSchema.sortOrder })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.projectId, documentInput.targetProjectId),
          documentInput.targetParentId
            ? eq(documentsSchema.parentId, documentInput.targetParentId)
            : isNull(documentsSchema.parentId),
        ),
      )
      .orderBy(desc(documentsSchema.sortOrder))
      .limit(1);

    finalSortOrder = (latestSibling?.sortOrder ?? 0) + 1000;
  }

  const updatedDocument = await db.transaction(async (transaction) => {
    await requireProjectPermissionInTransaction({
      permission: 'document.update',
      projectId: sourceAuthorization.document.projectId,
      transaction,
      userId,
    });

    if (isCrossProjectMove) {
      await requireProjectPermissionInTransaction({
        permission: 'document.create',
        projectId: documentInput.targetProjectId,
        transaction,
        userId,
      });

      const descendantIds: string[] = [];
      let pendingParentIds = [documentInput.documentId];

      while (pendingParentIds.length > 0) {
        const children = await transaction
          .select({ id: documentsSchema.id })
          .from(documentsSchema)
          .where(inArray(documentsSchema.parentId, pendingParentIds));

        const childIds = children.map((child) => child.id);

        if (childIds.length === 0) {
          break;
        }

        descendantIds.push(...childIds);
        pendingParentIds = childIds;
      }

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
        sortOrder: finalSortOrder,
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
