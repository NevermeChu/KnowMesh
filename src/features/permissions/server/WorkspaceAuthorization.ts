import 'server-only';
import { and, eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { AuthorizationError } from '../AuthorizationError';
import type { Permission } from '../Permission';
import { getWorkspacePermissions } from '../PermissionPolicy';

const getCachedWorkspaceAuthorization = cache(async (workspaceId: string, userId: string) => {
  const [access] = await db
    .select({
      id: workspacesSchema.id,
      kind: workspacesSchema.kind,
      name: workspacesSchema.name,
      ownerId: workspacesSchema.ownerId,
      role: workspaceMembersSchema.role,
    })
    .from(workspacesSchema)
    .innerJoin(workspaceMembersSchema, eq(workspaceMembersSchema.workspaceId, workspacesSchema.id))
    .where(and(eq(workspacesSchema.id, workspaceId), eq(workspaceMembersSchema.userId, userId)))
    .limit(1);

  if (!access) {
    return null;
  }

  const role = access.ownerId === userId ? 'owner' : access.role;

  return {
    decision: {
      grants: [{ role, source: 'workspace' as const }],
      isResourceOwner: access.ownerId === userId,
      permissions: getWorkspacePermissions(role, access.kind),
    },
    workspace: access,
  };
});

export async function getWorkspaceAuthorization(options: { userId: string; workspaceId: string }) {
  return await getCachedWorkspaceAuthorization(options.workspaceId, options.userId);
}

export async function authorizeWorkspace(options: {
  permission: Permission;
  userId: string;
  workspaceId: string;
}) {
  const authorization = await getWorkspaceAuthorization(options);

  if (!authorization?.decision.permissions.includes(options.permission)) {
    throw new AuthorizationError();
  }

  return authorization;
}
