'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { AuthorizationError } from '@/features/permissions/AuthorizationError';
import { removeWorkspaceForUser } from '@/features/permissions/server/ResourceRemoval';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import { db } from '@/libs/DB';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';
import { deleteWorkspaceSchema } from '../WorkspaceSchema';
import type { DeleteWorkspaceInput } from '../WorkspaceSchema';

export async function deleteOrLeaveWorkspace(input: DeleteWorkspaceInput) {
  const { id: userId } = await requireUser();
  const workspaceInput = deleteWorkspaceSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.read',
    userId,
    workspaceId: workspaceInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不可删除或退出');
  }

  const isOwner = authorization.workspace.ownerId === userId;
  if (isOwner && !authorization.decision.permissions.includes('workspace.delete')) {
    throw new AuthorizationError();
  }

  const operation = await db.transaction(
    async (transaction) =>
      await removeWorkspaceForUser(transaction, {
        isOwner,
        userId,
        workspaceId: authorization.workspace.id,
      }),
  );

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === authorization.workspace.id) {
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  }

  revalidatePath('/(workspace)', 'layout');
  return { operation };
}
