'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/libs/DB';
import { projectMembersSchema, projectsSchema } from '@/models/Schema';
import { createProjectSchema } from '../CreateProjectSchema';
import type { CreateProjectInput } from '../CreateProjectSchema';

export async function createProject(input: CreateProjectInput) {
  const { userId } = await auth.protect();
  const projectInput = createProjectSchema.parse(input);

  return await db.transaction(async (transaction) => {
    const [project] = await transaction
      .insert(projectsSchema)
      .values({
        kind: projectInput.kind,
        name: projectInput.name,
        ownerId: userId,
      })
      .returning({
        createdAt: projectsSchema.createdAt,
        id: projectsSchema.id,
        kind: projectsSchema.kind,
        name: projectsSchema.name,
        updatedAt: projectsSchema.updatedAt,
      });

    if (!project) {
      throw new Error('项目创建失败');
    }

    await transaction.insert(projectMembersSchema).values({
      projectId: project.id,
      role: 'owner',
      userId,
    });

    return project;
  });
}
