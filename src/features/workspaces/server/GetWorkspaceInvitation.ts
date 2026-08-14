import 'server-only';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { hashWorkspaceInvitationToken } from '@/features/permissions/server/WorkspaceInvitationToken';
import type { WorkspaceInvitationPageData } from '@/features/workspaces/WorkspaceInvitation';
import {
  formatWorkspaceInvitationExpiration,
  getWorkspaceInvitationInviterName,
  WORKSPACE_INVITATION_ROLE_LABEL,
} from '@/features/workspaces/WorkspaceInvitation';
import { db } from '@/libs/DB';
import { workspaceInvitationsSchema, workspacesSchema } from '@/models/Schema';

/**
 * Reads an invitation summary only after matching the current user's verified email.
 *
 * @param options - Raw invitation token from the acceptance URL.
 * @returns The invitation display data or its current terminal status.
 */
export async function getWorkspaceInvitation(options: {
  token: string;
}): Promise<WorkspaceInvitationPageData> {
  const user = await currentUser();

  if (!user) {
    return { status: 'invalid' };
  }

  const [invitation] = await db
    .select({
      acceptedAt: workspaceInvitationsSchema.acceptedAt,
      email: workspaceInvitationsSchema.email,
      expiresAt: workspaceInvitationsSchema.expiresAt,
      invitedById: workspaceInvitationsSchema.invitedById,
      revokedAt: workspaceInvitationsSchema.revokedAt,
      workspaceName: workspacesSchema.name,
    })
    .from(workspaceInvitationsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, workspaceInvitationsSchema.workspaceId))
    .where(eq(workspaceInvitationsSchema.tokenHash, hashWorkspaceInvitationToken(options.token)))
    .limit(1);

  if (!invitation) {
    return { status: 'invalid' };
  }

  const verifiedEmails = new Set(
    user.emailAddresses
      .filter((emailAddress) => emailAddress.verification?.status === 'verified')
      .map((emailAddress) => emailAddress.emailAddress.toLowerCase()),
  );

  if (!verifiedEmails.has(invitation.email)) {
    return { status: 'email-mismatch' };
  }

  if (invitation.revokedAt) {
    return { status: 'revoked' };
  }

  if (invitation.acceptedAt) {
    return { status: 'accepted' };
  }

  if (invitation.expiresAt <= new Date()) {
    return { status: 'expired' };
  }

  const client = await clerkClient();
  const inviters = await client.users.getUserList({ userId: [invitation.invitedById] });
  const [inviter] = inviters.data;

  return {
    invitation: {
      expiresAtLabel: formatWorkspaceInvitationExpiration(invitation.expiresAt),
      inviteeEmail: invitation.email,
      inviterName: inviter ? getWorkspaceInvitationInviterName(inviter) : 'KnowMesh 成员',
      roleLabel: WORKSPACE_INVITATION_ROLE_LABEL,
      workspaceName: invitation.workspaceName,
    },
    status: 'ready',
  };
}
