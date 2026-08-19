import 'server-only';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { cache } from 'react';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { db } from '@/libs/DB';
import { workspaceInvitationsSchema, workspacesSchema } from '@/models/Schema';

export type PendingInvitationItem = {
  expiresAt: Date;
  workspaceName: string;
};

/**
 * Reads outstanding workspace invitations addressed to the current user's
 * verified email addresses. Accepting still requires the emailed token link.
 *
 * @param limit - Maximum number of invitations to return.
 * @returns Pending invitations with their workspace names.
 */
export const getPendingInvitations = cache(async (limit = 5): Promise<PendingInvitationItem[]> => {
  const user = await requireUser();

  return await db
    .select({
      expiresAt: workspaceInvitationsSchema.expiresAt,
      workspaceName: workspacesSchema.name,
    })
    .from(workspaceInvitationsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, workspaceInvitationsSchema.workspaceId))
    .where(
      and(
        eq(workspaceInvitationsSchema.email, user.email.toLowerCase()),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
        gt(workspaceInvitationsSchema.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(workspaceInvitationsSchema.createdAt))
    .limit(limit);
});
