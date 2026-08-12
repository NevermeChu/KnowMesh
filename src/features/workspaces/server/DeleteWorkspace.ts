'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { db } from '@/libs/DB';
import { workspacesSchema } from '@/models/Schema';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';
import { deleteWorkspaceSchema } from '../WorkspaceSchema';
import type { DeleteWorkspaceInput } from '../WorkspaceSchema';

export async function deleteWorkspace(input: DeleteWorkspaceInput) {
  const { userId } = await auth.protect();
  const workspaceInput = deleteWorkspaceSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.delete',
    userId,
    workspaceId: workspaceInput.workspaceId,
  });
  const [workspace] = await db
    .delete(workspacesSchema)
    .where(eq(workspacesSchema.id, authorization.workspace.id))
    .returning({ id: workspacesSchema.id });

  if (!workspace) {
    throw new Error('工作区删除失败');
  }

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === workspace.id) {
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  }

  revalidatePath('/(workspace)', 'layout');
  return workspace;
}
