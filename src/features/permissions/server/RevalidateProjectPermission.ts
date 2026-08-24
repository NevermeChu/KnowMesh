import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { db } from '@/libs/DB';
import {
  projectMembersSchema,
  projectsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';
import { AuthorizationError } from '../AuthorizationError';
import type { Permission } from '../Permission';
import { getProjectPermissionDecision } from '../PermissionPolicy';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Locks the project and both membership rows, then re-verifies the permission
 * against current state so a revocation between check and write is caught.
 *
 * @param options - Transaction, project id, caller id, and required permission.
 * @returns The locked project row with workspace context.
 * @throws AuthorizationError when the project or memberships no longer grant access.
 */
export async function requireProjectPermissionInTransaction(options: {
  permission: Permission;
  projectId: string;
  transaction: Transaction;
  userId: string;
}) {
  const [project] = await options.transaction
    .select({
      kind: workspacesSchema.kind,
      name: projectsSchema.name,
      ownerId: projectsSchema.ownerId,
      workspaceId: projectsSchema.workspaceId,
    })
    .from(projectsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
    .where(eq(projectsSchema.id, options.projectId))
    .limit(1)
    .for('update', { of: projectsSchema });

  if (!project) {
    throw new AuthorizationError();
  }

  const [projectMember] = await options.transaction
    .select({ role: projectMembersSchema.role })
    .from(projectMembersSchema)
    .where(
      and(
        eq(projectMembersSchema.projectId, options.projectId),
        eq(projectMembersSchema.userId, options.userId),
      ),
    )
    .limit(1)
    .for('update', { of: projectMembersSchema });

  const [workspaceMember] = await options.transaction
    .select({ role: workspaceMembersSchema.role })
    .from(workspaceMembersSchema)
    .where(
      and(
        eq(workspaceMembersSchema.workspaceId, project.workspaceId),
        eq(workspaceMembersSchema.userId, options.userId),
      ),
    )
    .limit(1)
    .for('update', { of: workspaceMembersSchema });

  if (!workspaceMember) {
    throw new AuthorizationError();
  }

  const decision = getProjectPermissionDecision({
    isProjectOwner: project.ownerId === options.userId,
    projectRole: projectMember?.role ?? null,
    workspaceKind: project.kind,
    workspaceRole: workspaceMember.role,
  });

  if (!decision.permissions.includes(options.permission)) {
    throw new AuthorizationError();
  }

  return project;
}
