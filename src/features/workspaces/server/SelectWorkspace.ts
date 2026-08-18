'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { db } from '@/libs/DB';
import { workspaceMembersSchema } from '@/models/Schema';
import { ACTIVE_WORKSPACE_COOKIE } from '../Workspace';
import { selectWorkspaceSchema } from '../WorkspaceSchema';

export async function selectWorkspace(input: { workspaceId: string }) {
  const { id: userId } = await requireUser();
  const workspaceInput = selectWorkspaceSchema.parse(input);
  const [membership] = await db
    .select({ workspaceId: workspaceMembersSchema.workspaceId })
    .from(workspaceMembersSchema)
    .where(
      and(
        eq(workspaceMembersSchema.workspaceId, workspaceInput.workspaceId),
        eq(workspaceMembersSchema.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new Error('没有权限访问该工作区');
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, membership.workspaceId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  revalidatePath('/(workspace)', 'layout');
}
