import 'server-only';
import { and, eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/libs/DB';
import {
  projectMembersSchema,
  projectsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';
import { AuthorizationError } from '../AuthorizationError';
import type { Permission } from '../Permission';
import { getProjectPermissionDecision } from '../PermissionPolicy';

const getCachedProjectAuthorization = cache(async (projectId: string, userId: string) => {
  const [access] = await db
    .select({
      id: projectsSchema.id,
      name: projectsSchema.name,
      ownerId: projectsSchema.ownerId,
      projectRole: projectMembersSchema.role,
      workspaceId: projectsSchema.workspaceId,
      workspaceRole: workspaceMembersSchema.role,
      workspaceKind: workspacesSchema.kind,
    })
    .from(projectsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .innerJoin(
      workspaceMembersSchema,
      and(
        eq(workspaceMembersSchema.workspaceId, projectsSchema.workspaceId),
        eq(workspaceMembersSchema.userId, userId),
      ),
    )
    .leftJoin(
      projectMembersSchema,
      and(
        eq(projectMembersSchema.projectId, projectsSchema.id),
        eq(projectMembersSchema.userId, userId),
      ),
    )
    .where(eq(projectsSchema.id, projectId))
    .limit(1);

  if (!access) {
    return null;
  }

  const decision = getProjectPermissionDecision({
    isProjectOwner: access.ownerId === userId,
    projectRole: access.projectRole,
    workspaceRole: access.workspaceRole,
    workspaceKind: access.workspaceKind,
  });

  return { decision, project: access };
});

export async function getProjectAuthorization(options: { projectId: string; userId: string }) {
  return await getCachedProjectAuthorization(options.projectId, options.userId);
}

export async function authorizeProject(options: {
  permission: Permission;
  projectId: string;
  userId: string;
}) {
  const authorization = await getProjectAuthorization(options);

  if (!authorization?.decision.permissions.includes(options.permission)) {
    throw new AuthorizationError();
  }

  return authorization;
}
