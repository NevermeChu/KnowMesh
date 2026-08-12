'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';
import { createWorkspaceSchema } from '../WorkspaceSchema';
import type { CreateWorkspaceInput } from '../WorkspaceSchema';

export async function createWorkspace(input: CreateWorkspaceInput) {
  const { userId } = await auth.protect();
  const workspaceInput = createWorkspaceSchema.parse(input);
  const workspace = await db.transaction(async (transaction) => {
    const [createdWorkspace] = await transaction
      .insert(workspacesSchema)
      .values({ kind: 'team', name: workspaceInput.name, ownerId: userId })
      .returning({
        id: workspacesSchema.id,
      });

    if (!createdWorkspace) {
      throw new Error('工作区创建失败');
    }

    await transaction.insert(workspaceMembersSchema).values({
      role: 'owner',
      userId,
      workspaceId: createdWorkspace.id,
    });

    return createdWorkspace;
  });
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  revalidatePath('/(workspace)', 'layout');
}
