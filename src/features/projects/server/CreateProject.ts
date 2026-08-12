'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { db } from '@/libs/DB';
import { projectMembersSchema, projectsSchema } from '@/models/Schema';
import { createProjectSchema } from '../CreateProjectSchema';
import type { CreateProjectInput } from '../CreateProjectSchema';

export async function createProject(input: CreateProjectInput) {
  const { userId } = await auth.protect();
  const projectInput = createProjectSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'project.create',
    userId,
    workspaceId: projectInput.workspaceId,
  });

  const project = await db.transaction(async (transaction) => {
    const [createdProject] = await transaction
      .insert(projectsSchema)
      .values({
        kind: projectInput.kind,
        name: projectInput.name,
        ownerId: userId,
        workspaceId: authorization.workspace.id,
      })
      .returning({
        createdAt: projectsSchema.createdAt,
        id: projectsSchema.id,
        kind: projectsSchema.kind,
        name: projectsSchema.name,
        updatedAt: projectsSchema.updatedAt,
        workspaceId: projectsSchema.workspaceId,
      });

    if (!createdProject) {
      throw new Error('项目创建失败');
    }

    await transaction.insert(projectMembersSchema).values({
      projectId: createdProject.id,
      role: 'owner',
      userId,
    });

    return createdProject;
  });

  revalidatePath('/(workspace)', 'layout');
  return project;
}
