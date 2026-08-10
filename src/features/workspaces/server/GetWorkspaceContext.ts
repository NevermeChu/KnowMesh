import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { asc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';

export async function getWorkspaceContext() {
  const { userId } = await auth.protect();
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
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? workspaces[0] ?? null;

  return { activeWorkspace, workspaces };
}
