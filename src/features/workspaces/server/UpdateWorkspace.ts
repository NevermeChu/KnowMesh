'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { db } from '@/libs/DB';
import { workspacesSchema } from '@/models/Schema';
import { updateWorkspaceSchema } from '../WorkspaceSchema';
import type { UpdateWorkspaceInput } from '../WorkspaceSchema';

export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const { userId } = await auth.protect();
  const workspaceInput = updateWorkspaceSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.update',
    userId,
    workspaceId: workspaceInput.workspaceId,
  });
  const [workspace] = await db
    .update(workspacesSchema)
    .set({ name: workspaceInput.name, updatedAt: new Date() })
    .where(eq(workspacesSchema.id, authorization.workspace.id))
    .returning({ id: workspacesSchema.id, name: workspacesSchema.name });

  if (!workspace) {
    throw new Error('工作区保存失败');
  }

  revalidatePath('/(workspace)', 'layout');
  return workspace;
}
