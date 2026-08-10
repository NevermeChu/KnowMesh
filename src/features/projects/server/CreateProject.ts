'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/libs/DB';
import { projectMembersSchema, projectsSchema, workspaceMembersSchema } from '@/models/Schema';
import { createProjectSchema } from '../CreateProjectSchema';
import type { CreateProjectInput } from '../CreateProjectSchema';

export async function createProject(input: CreateProjectInput) {
  const { userId } = await auth.protect();
  const projectInput = createProjectSchema.parse(input);
  const [workspaceMembership] = await db
    .select({ workspaceId: workspaceMembersSchema.workspaceId })
    .from(workspaceMembersSchema)
    .where(
      and(
        eq(workspaceMembersSchema.workspaceId, projectInput.workspaceId),
        eq(workspaceMembersSchema.userId, userId),
      ),
    )
    .limit(1);

  if (!workspaceMembership) {
    throw new Error('没有权限在该工作区创建项目');
  }

  const project = await db.transaction(async (transaction) => {
    const [createdProject] = await transaction
      .insert(projectsSchema)
      .values({
        kind: projectInput.kind,
        name: projectInput.name,
        ownerId: userId,
        workspaceId: workspaceMembership.workspaceId,
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
