import 'server-only';
import { eq, or } from 'drizzle-orm';
import { removeWorkspaceForUser } from '@/features/permissions/server/ResourceRemoval';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  notificationsSchema,
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectMembersSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';

export const DELETED_USER_ID = 'deleted_user';

/**
 * Deletes resources owned by a removed Clerk user and exits resources owned by others.
 *
 * @param userId - Deleted Clerk user identifier from a verified webhook.
 */
export async function deleteUserData(userId: string) {
  await db.transaction(async (transaction) => {
    const workspaces = await transaction
      .select({ id: workspacesSchema.id, ownerId: workspacesSchema.ownerId })
      .from(workspaceMembersSchema)
      .innerJoin(workspacesSchema, eq(workspacesSchema.id, workspaceMembersSchema.workspaceId))
      .where(eq(workspaceMembersSchema.userId, userId));

    for (const workspace of workspaces) {
      await removeWorkspaceForUser(transaction, {
        isOwner: workspace.ownerId === userId,
        userId,
        workspaceId: workspace.id,
      });
    }

    await transaction
      .delete(notificationsSchema)
      .where(eq(notificationsSchema.recipientUserId, userId));
    await transaction
      .update(notificationsSchema)
      .set({ actorUserId: null })
      .where(eq(notificationsSchema.actorUserId, userId));

    await transaction
      .delete(projectInvitationsSchema)
      .where(
        or(
          eq(projectInvitationsSchema.userId, userId),
          eq(projectInvitationsSchema.invitedById, userId),
        ),
      );
    await transaction
      .delete(projectAccessRequestsSchema)
      .where(eq(projectAccessRequestsSchema.userId, userId));
    await transaction
      .delete(workspaceInvitationsSchema)
      .where(
        or(
          eq(workspaceInvitationsSchema.invitedById, userId),
          eq(workspaceInvitationsSchema.acceptedById, userId),
        ),
      );
    await transaction
      .delete(workspaceAccessRequestsSchema)
      .where(eq(workspaceAccessRequestsSchema.userId, userId));
    await transaction.delete(projectMembersSchema).where(eq(projectMembersSchema.userId, userId));
    await transaction
      .delete(workspaceMembersSchema)
      .where(eq(workspaceMembersSchema.userId, userId));

    await transaction
      .update(documentsSchema)
      .set({ createdById: DELETED_USER_ID })
      .where(eq(documentsSchema.createdById, userId));
  });
}
