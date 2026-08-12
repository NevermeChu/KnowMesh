'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { projectsSchema } from '@/models/Schema';
import { updateProjectSchema } from '../ProjectMutationSchema';
import type { UpdateProjectInput } from '../ProjectMutationSchema';

export async function updateProject(input: UpdateProjectInput) {
  const { userId } = await auth.protect();
  const projectInput = updateProjectSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.update',
    projectId: projectInput.projectId,
    userId,
  });
  const [project] = await db
    .update(projectsSchema)
    .set({ name: projectInput.name, updatedAt: new Date() })
    .where(eq(projectsSchema.id, authorization.project.id))
    .returning({ id: projectsSchema.id });

  if (!project) {
    throw new Error('项目保存失败');
  }

  revalidatePath('/(workspace)', 'layout');
}
