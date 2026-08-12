import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { AuthorizationError } from '../AuthorizationError';
import type { Permission } from '../Permission';
import { getWorkspacePermissions } from '../PermissionPolicy';

export async function getWorkspaceAuthorization(options: { userId: string; workspaceId: string }) {
  const [access] = await db
    .select({
      id: workspacesSchema.id,
      name: workspacesSchema.name,
      ownerId: workspacesSchema.ownerId,
      role: workspaceMembersSchema.role,
    })
    .from(workspacesSchema)
    .innerJoin(workspaceMembersSchema, eq(workspaceMembersSchema.workspaceId, workspacesSchema.id))
    .where(
      and(
        eq(workspacesSchema.id, options.workspaceId),
        eq(workspaceMembersSchema.userId, options.userId),
      ),
    )
    .limit(1);

  if (!access) {
    return null;
  }

  const role = access.ownerId === options.userId ? 'owner' : access.role;

  return {
    decision: {
      grants: [{ role, source: 'workspace' as const }],
      isResourceOwner: access.ownerId === options.userId,
      permissions: getWorkspacePermissions(role),
    },
    workspace: access,
  };
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
