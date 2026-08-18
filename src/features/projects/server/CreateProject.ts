'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { AuthorizationError } from '@/features/permissions/AuthorizationError';
import { getWorkspacePermissions } from '@/features/permissions/PermissionPolicy';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { db } from '@/libs/DB';
import { projectMembersSchema, projectsSchema, workspaceMembersSchema } from '@/models/Schema';
import { createProjectSchema } from '../CreateProjectSchema';
import type { CreateProjectInput } from '../CreateProjectSchema';

export async function createProject(input: CreateProjectInput) {
  const { id: userId } = await requireUser();
  const projectInput = createProjectSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'project.create',
    userId,
    workspaceId: projectInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal' && authorization.workspace.ownerId !== userId) {
    throw new Error('个人项目只能创建在自己的个人空间');
  }

  await db.transaction(async (transaction) => {
    const [membership] = await transaction
      .select({ role: workspaceMembersSchema.role })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, authorization.workspace.id),
          eq(workspaceMembersSchema.userId, userId),
        ),
      )
      .for('update');
    let role = membership?.role;

    if (membership && authorization.workspace.ownerId === userId) {
      role = 'owner';
    }

    if (
      !role ||
      !getWorkspacePermissions(role, authorization.workspace.kind).includes('project.create')
    ) {
      throw new AuthorizationError();
    }

    const [createdProject] = await transaction
      .insert(projectsSchema)
      .values({
        name: projectInput.name,
        ownerId: userId,
        workspaceId: authorization.workspace.id,
      })
      .returning({
        id: projectsSchema.id,
      });

    if (!createdProject) {
      throw new Error('项目创建失败');
    }

    await transaction.insert(projectMembersSchema).values({
      projectId: createdProject.id,
      role: 'owner',
      userId,
      workspaceId: authorization.workspace.id,
    });
  });

  revalidatePath('/(workspace)', 'layout');
}
