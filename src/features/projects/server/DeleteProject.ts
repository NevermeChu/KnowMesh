'use server';

import { revalidatePath } from 'next/cache';
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
  const operation = await db.transaction(
    async (transaction) =>
      await removeProjectForUser(transaction, {
        isOwner: authorization.project.ownerId === userId,
        projectId: authorization.project.id,
        userId,
      }),
  );

  revalidatePath('/(workspace)', 'layout');
  return { operation };
}
