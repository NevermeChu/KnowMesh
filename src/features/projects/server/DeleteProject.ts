'use server';

import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/features/audit-logs/server/RecordAuditLog';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { removeProjectForUser } from '@/features/permissions/server/ResourceRemoval';
import { db } from '@/libs/DB';
import { deleteProjectSchema } from '../ProjectMutationSchema';
import type { DeleteProjectInput } from '../ProjectMutationSchema';

export async function deleteOrLeaveProject(input: DeleteProjectInput) {
  const { id: userId } = await requireUser();
  const projectInput = deleteProjectSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.read',
    projectId: projectInput.projectId,
    userId,
  });
  const operation = await db.transaction(async (transaction) => {
    const result = await removeProjectForUser(transaction, {
      isOwner: authorization.project.ownerId === userId,
      projectId: authorization.project.id,
      userId,
    });

    if (authorization.project.workspaceKind === 'team') {
      await recordAuditLog(transaction, {
        action: result === 'deleted' ? 'project_deleted' : 'project_member_removed',
        actorUserId: userId,
        metadata: {
          resourceName: authorization.project.name,
          targetUserId: userId,
        },
        targetId: authorization.project.id,
        targetKind: 'project',
        workspaceId: authorization.project.workspaceId,
      });
    }

    return result;
  });

  revalidatePath('/(workspace)', 'layout');
  return { operation };
}
