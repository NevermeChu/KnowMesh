import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { createNotification } from '@/features/notifications/server/CreateNotification';
import { db } from '@/libs/DB';
import { notificationsSchema, workspaceInvitationsSchema, workspacesSchema } from '@/models/Schema';

/**
 * Synchronizes pending workspace invitations for a newly registered user
 * and generates in-app notifications for active invitations matching their verified emails.
 *
 * @param userId - The Better Auth user identifier whose email was verified.
 * @param emailAddresses - The verified account email addresses.
 */
export async function syncPendingWorkspaceInvitations(userId: string, emailAddresses: string[]) {
  if (emailAddresses.length === 0) {
    return;
  }

  const normalizedEmails = emailAddresses.map((email) => email.toLowerCase());

  const pendingInvitations = await db
    .select({
      id: workspaceInvitationsSchema.id,
      invitedById: workspaceInvitationsSchema.invitedById,
      workspaceId: workspaceInvitationsSchema.workspaceId,
      workspaceName: workspacesSchema.name,
    })
    .from(workspaceInvitationsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, workspaceInvitationsSchema.workspaceId))
    .where(
      and(
        inArray(sql`lower(${workspaceInvitationsSchema.email})`, normalizedEmails),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
        gt(workspaceInvitationsSchema.expiresAt, new Date()),
      ),
    );

  if (pendingInvitations.length === 0) {
    return;
  }

  const existingNotifications = await db
    .select({ targetId: notificationsSchema.targetId })
    .from(notificationsSchema)
    .where(
      and(
        eq(notificationsSchema.recipientUserId, userId),
        eq(notificationsSchema.type, 'workspace_invited'),
        eq(notificationsSchema.targetKind, 'workspace'),
      ),
    );

  const existingWorkspaceIds = new Set(
    existingNotifications.map((notification) => notification.targetId).filter(Boolean),
  );

  const processedWorkspaceIds = new Set<string>();

  for (const invitation of pendingInvitations) {
    if (
      existingWorkspaceIds.has(invitation.workspaceId) ||
      processedWorkspaceIds.has(invitation.workspaceId)
    ) {
      continue;
    }

    processedWorkspaceIds.add(invitation.workspaceId);

    await createNotification(db, {
      actorUserId: invitation.invitedById,
      body: `你收到了加入工作区“${invitation.workspaceName}”的邀请。`,
      recipientUserId: userId,
      target: { id: invitation.workspaceId, kind: 'workspace' },
      title: '收到工作区邀请',
      type: 'workspace_invited',
    });
  }
}
