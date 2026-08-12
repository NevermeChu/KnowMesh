'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { projectsSchema } from '@/models/Schema';
import { deleteProjectSchema } from '../ProjectMutationSchema';
import type { DeleteProjectInput } from '../ProjectMutationSchema';

export async function deleteProject(input: DeleteProjectInput) {
  const { userId } = await auth.protect();
  const projectInput = deleteProjectSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.delete',
    projectId: projectInput.projectId,
    userId,
  });
  const [project] = await db
    .delete(projectsSchema)
    .where(eq(projectsSchema.id, authorization.project.id))
    .returning({ id: projectsSchema.id });

  if (!project) {
    throw new Error('项目删除失败');
  }

  revalidatePath('/(workspace)', 'layout');
  return project;
}
