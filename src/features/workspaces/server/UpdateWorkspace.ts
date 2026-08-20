'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/features/audit-logs/server/RecordAuditLog';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { db } from '@/libs/DB';
import { workspacesSchema } from '@/models/Schema';
import { updateWorkspaceSchema } from '../WorkspaceSchema';
import type { UpdateWorkspaceInput } from '../WorkspaceSchema';

export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const { id: userId } = await requireUser();
  const workspaceInput = updateWorkspaceSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.update',
    userId,
    workspaceId: workspaceInput.workspaceId,
  });
  await db.transaction(async (transaction) => {
    const [workspace] = await transaction
      .update(workspacesSchema)
      .set({ name: workspaceInput.name, updatedAt: new Date() })
      .where(eq(workspacesSchema.id, authorization.workspace.id))
      .returning({ id: workspacesSchema.id });

    if (!workspace) {
      throw new Error('工作区保存失败');
    }

    if (authorization.workspace.kind === 'team') {
      await recordAuditLog(transaction, {
        action: 'workspace_renamed',
        actorUserId: userId,
        metadata: {
          nextName: workspaceInput.name,
          previousName: authorization.workspace.name,
          resourceName: workspaceInput.name,
        },
        targetId: authorization.workspace.id,
        targetKind: 'workspace',
        workspaceId: authorization.workspace.id,
      });
    }
  });

  revalidatePath('/(workspace)', 'layout');
}
