'use server';

import { and, eq, sql } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { requireProjectPermissionInTransaction } from '@/features/permissions/server/RevalidateProjectPermission';
import { db } from '@/libs/DB';
import { documentsSchema, documentWhiteboardStatesSchema } from '@/models/Schema';
import { updatePersonalWhiteboardSchema } from '../WhiteboardScene';
import type { UpdatePersonalWhiteboardInput } from '../WhiteboardScene';

export async function updatePersonalWhiteboard(input: UpdatePersonalWhiteboardInput) {
  const { id: userId } = await requireUser();
  const whiteboardInput = updatePersonalWhiteboardSchema.parse(input);
  const authorization = await authorizeDocument({
    documentId: whiteboardInput.documentId,
    permission: 'document.update',
    userId,
  });

  return await db.transaction(async (transaction) => {
    const project = await requireProjectPermissionInTransaction({
      permission: 'document.update',
      projectId: authorization.document.projectId,
      transaction,
      userId,
    });
    const [lockedDocument] = await transaction
      .select({ id: documentsSchema.id, kind: documentsSchema.kind })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.id, whiteboardInput.documentId),
          eq(documentsSchema.projectId, authorization.document.projectId),
        ),
      )
      .limit(1)
      .for('update', { of: documentsSchema });

    if (!lockedDocument) {
      throw new Error('白板保存失败');
    }
    if (lockedDocument.kind !== 'whiteboard') {
      throw new Error('富文本文档不能通过白板保存入口保存');
    }
    if (project.kind !== 'personal') {
      throw new Error('团队白板必须通过白板协作服务保存');
    }

    const [lockedState] = await transaction
      .select({ revision: documentWhiteboardStatesSchema.revision })
      .from(documentWhiteboardStatesSchema)
      .where(eq(documentWhiteboardStatesSchema.documentId, lockedDocument.id))
      .limit(1)
      .for('update', { of: documentWhiteboardStatesSchema });

    if (!lockedState) {
      throw new Error('白板状态不存在');
    }
    if (lockedState.revision !== whiteboardInput.expectedRevision) {
      return { revision: lockedState.revision, status: 'conflict' as const };
    }

    const savedAt = new Date();
    const [savedState] = await transaction
      .update(documentWhiteboardStatesSchema)
      .set({
        revision: sql`${documentWhiteboardStatesSchema.revision} + 1`,
        scene: whiteboardInput.scene,
        updatedAt: savedAt,
      })
      .where(eq(documentWhiteboardStatesSchema.documentId, lockedDocument.id))
      .returning({
        revision: documentWhiteboardStatesSchema.revision,
        updatedAt: documentWhiteboardStatesSchema.updatedAt,
      });

    if (!savedState) {
      throw new Error('白板保存失败');
    }

    await transaction
      .update(documentsSchema)
      .set({ updatedAt: savedAt })
      .where(eq(documentsSchema.id, lockedDocument.id));

    return {
      revision: savedState.revision,
      status: 'saved' as const,
      updatedAt: savedState.updatedAt,
    };
  });
}
