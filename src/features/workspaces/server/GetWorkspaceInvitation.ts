import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { hashWorkspaceInvitationToken } from '@/features/permissions/server/WorkspaceInvitationToken';
import { getUserProfiles } from '@/features/users/server/GetUserProfiles';
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
 * @param options - Raw invitation token or workspace ID for authenticated in-app lookup.
 * @returns The invitation display data or its current terminal status.
 */
export async function getWorkspaceInvitation(options: {
  token?: string;
  workspaceId?: string;
}): Promise<WorkspaceInvitationPageData> {
  const user = await requireUser();

  let whereCondition = null;
  if (options.token) {
    whereCondition = eq(
      workspaceInvitationsSchema.tokenHash,
      hashWorkspaceInvitationToken(options.token),
    );
  } else if (options.workspaceId) {
    whereCondition = and(
      eq(workspaceInvitationsSchema.workspaceId, options.workspaceId),
      eq(sql`lower(${workspaceInvitationsSchema.email})`, user.email.toLowerCase()),
    );
  }

  if (!whereCondition) {
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
    .where(whereCondition)
    .orderBy(desc(workspaceInvitationsSchema.createdAt))
    .limit(1);

  if (!invitation) {
    return { status: 'invalid' };
  }

  if (user.email.toLowerCase() !== invitation.email) {
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

  const inviterProfiles = await getUserProfiles([invitation.invitedById]);
  const inviter = inviterProfiles.get(invitation.invitedById);

  return {
    invitation: {
      expiresAtLabel: formatWorkspaceInvitationExpiration(invitation.expiresAt),
      inviteeEmail: invitation.email,
      inviterName: inviter
        ? getWorkspaceInvitationInviterName({ email: inviter.email, name: inviter.displayName })
        : 'KnowMesh 成员',
      roleLabel: WORKSPACE_INVITATION_ROLE_LABEL,
      workspaceName: invitation.workspaceName,
    },
    status: 'ready',
  };
}
