import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { workspaceMembersSchema, workspacesSchema } from '@/models/Schema';

const DEFAULT_WORKSPACE_NAME = '我的工作区';

/**
 * Idempotently provisions the permanent personal workspace for a Clerk user.
 *
 * @param userId - Verified Clerk user identifier from a trusted server boundary.
 * @returns The existing or newly created personal workspace.
 */
export async function ensureUserWorkspace(userId: string) {
  return await db.transaction(async (transaction) => {
    const [existingWorkspace] = await transaction
      .select({ id: workspacesSchema.id })
      .from(workspacesSchema)
      .where(and(eq(workspacesSchema.kind, 'personal'), eq(workspacesSchema.ownerId, userId)))
      .limit(1);

    if (existingWorkspace) {
      return existingWorkspace;
    }

    const [workspace] = await transaction
      .insert(workspacesSchema)
      .values({ kind: 'personal', name: DEFAULT_WORKSPACE_NAME, ownerId: userId })
      .onConflictDoNothing()
      .returning({ id: workspacesSchema.id });

    if (!workspace) {
      const [concurrentWorkspace] = await transaction
        .select({ id: workspacesSchema.id })
        .from(workspacesSchema)
        .where(and(eq(workspacesSchema.kind, 'personal'), eq(workspacesSchema.ownerId, userId)))
        .limit(1);

      if (!concurrentWorkspace) {
        throw new Error('个人空间创建失败');
      }

      return concurrentWorkspace;
    }

    await transaction.insert(workspaceMembersSchema).values({
      role: 'owner',
      userId,
      workspaceId: workspace.id,
    });

    return workspace;
  });
}
