import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { userOnboardingSchema, workspaceMembersSchema, workspacesSchema } from '@/models/Schema';

const DEFAULT_WORKSPACE_NAME = '我的工作区';

/**
 * Initializes a user's ordinary default workspace exactly once.
 *
 * @param userId - Authenticated Clerk user identifier.
 * @returns The created workspace, or null when initialization already ran or membership exists.
 */
export async function ensureUserWorkspace(userId: string) {
  return await db.transaction(async (transaction) => {
    const [onboarding] = await transaction
      .insert(userOnboardingSchema)
      .values({ userId })
      .onConflictDoNothing()
      .returning({ userId: userOnboardingSchema.userId });

    if (!onboarding) {
      return null;
    }

    const [existingMembership] = await transaction
      .select({ workspaceId: workspaceMembersSchema.workspaceId })
      .from(workspaceMembersSchema)
      .where(eq(workspaceMembersSchema.userId, userId))
      .limit(1);

    if (existingMembership) {
      return null;
    }

    const [workspace] = await transaction
      .insert(workspacesSchema)
      .values({ name: DEFAULT_WORKSPACE_NAME, ownerId: userId })
      .returning({ id: workspacesSchema.id });

    if (!workspace) {
      throw new Error('默认工作区创建失败');
    }

    await transaction.insert(workspaceMembersSchema).values({
      role: 'owner',
      userId,
      workspaceId: workspace.id,
    });

    return workspace;
  });
}
