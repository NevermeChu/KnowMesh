import 'server-only';
import { eq, or } from 'drizzle-orm';
import { removeWorkspaceForUser } from '@/features/permissions/server/ResourceRemoval';
import type { db } from '@/libs/DB';
import {
  documentsSchema,
  notificationsSchema,
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectMembersSchema,
  starredDocumentsSchema,
  userPreferencesSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';

export const DELETED_USER_ID = 'deleted_user';

export class TeamWorkspaceOwnershipError extends Error {
  constructor() {
    super('删除账户前必须转让所有团队工作区的所有权');
    this.name = 'TeamWorkspaceOwnershipError';
  }
}

type UserDataDeletionDatabase = Pick<typeof db, 'delete' | 'select' | 'update'>;

/**
 * Deletes resources owned by a removed user and exits resources owned by others.
 *
 * @param database - Transaction that also removes the Better Auth identity.
 * @param userId - Better Auth user identifier from the account deletion boundary.
 */
export async function deleteUserData(database: UserDataDeletionDatabase, userId: string) {
  const workspaces = await database
    .select({
      id: workspacesSchema.id,
      kind: workspacesSchema.kind,
      ownerId: workspacesSchema.ownerId,
    })
    .from(workspaceMembersSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, workspaceMembersSchema.workspaceId))
    .where(eq(workspaceMembersSchema.userId, userId));

  if (workspaces.some((workspace) => workspace.kind === 'team' && workspace.ownerId === userId)) {
    throw new TeamWorkspaceOwnershipError();
  }

  for (const workspace of workspaces) {
    await removeWorkspaceForUser(database, {
      isOwner: workspace.ownerId === userId,
      userId,
      workspaceId: workspace.id,
    });
  }

  await database.delete(notificationsSchema).where(eq(notificationsSchema.recipientUserId, userId));
  await database
    .update(notificationsSchema)
    .set({ actorUserId: null })
    .where(eq(notificationsSchema.actorUserId, userId));

  await database
    .delete(projectInvitationsSchema)
    .where(
      or(
        eq(projectInvitationsSchema.userId, userId),
        eq(projectInvitationsSchema.invitedById, userId),
      ),
    );
  await database
    .delete(projectAccessRequestsSchema)
    .where(eq(projectAccessRequestsSchema.userId, userId));
  await database
    .delete(workspaceInvitationsSchema)
    .where(
      or(
        eq(workspaceInvitationsSchema.invitedById, userId),
        eq(workspaceInvitationsSchema.acceptedById, userId),
      ),
    );
  await database
    .delete(workspaceAccessRequestsSchema)
    .where(eq(workspaceAccessRequestsSchema.userId, userId));
  await database.delete(projectMembersSchema).where(eq(projectMembersSchema.userId, userId));
  await database.delete(workspaceMembersSchema).where(eq(workspaceMembersSchema.userId, userId));
  await database.delete(userPreferencesSchema).where(eq(userPreferencesSchema.userId, userId));
  await database.delete(starredDocumentsSchema).where(eq(starredDocumentsSchema.userId, userId));

  await database
    .update(documentsSchema)
    .set({ createdById: DELETED_USER_ID })
    .where(eq(documentsSchema.createdById, userId));
}
