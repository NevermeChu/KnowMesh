import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { asc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getWorkspacePermissions } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';
import { ensureUserWorkspace } from './EnsureUserWorkspace';

export async function getWorkspaceContext() {
  const { userId } = await auth.protect();
  await ensureUserWorkspace(userId);
  const workspaces = await db
    .select({
      createdAt: workspacesSchema.createdAt,
      id: workspacesSchema.id,
      name: workspacesSchema.name,
      role: workspaceMembersSchema.role,
      updatedAt: workspacesSchema.updatedAt,
    })
    .from(workspacesSchema)
    .innerJoin(workspaceMembersSchema, eq(workspaceMembersSchema.workspaceId, workspacesSchema.id))
    .where(eq(workspaceMembersSchema.userId, userId))
    .orderBy(asc(workspacesSchema.createdAt));
  const authorizedWorkspaces = workspaces.map((workspace) => ({
    ...workspace,
    permissions: getWorkspacePermissions(workspace.role),
  }));
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const activeWorkspace =
    authorizedWorkspaces.find((workspace) => workspace.id === requestedWorkspaceId) ??
    authorizedWorkspaces[0] ??
    null;

  return { activeWorkspace, workspaces: authorizedWorkspaces };
}
