import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { getWorkspacePermissions } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';

export const getWorkspaceContext = cache(async () => {
  const { id: userId } = await requireUser();
  const workspaces = await db
    .select({
      id: workspacesSchema.id,
      kind: workspacesSchema.kind,
      name: workspacesSchema.name,
      role: workspaceMembersSchema.role,
    })
    .from(workspacesSchema)
    .innerJoin(workspaceMembersSchema, eq(workspaceMembersSchema.workspaceId, workspacesSchema.id))
    .where(eq(workspaceMembersSchema.userId, userId))
    .orderBy(asc(workspacesSchema.createdAt));
  const authorizedWorkspaces = workspaces.map((workspace) => ({
    ...workspace,
    permissions: getWorkspacePermissions(workspace.role, workspace.kind),
  }));
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const personalWorkspace =
    authorizedWorkspaces.find(
      (workspace) => workspace.kind === 'personal' && workspace.role === 'owner',
    ) ?? null;
  const activeWorkspace =
    authorizedWorkspaces.find((workspace) => workspace.id === requestedWorkspaceId) ??
    personalWorkspace ??
    authorizedWorkspaces[0] ??
    null;

  return { activeWorkspace, personalWorkspace, workspaces: authorizedWorkspaces };
});
