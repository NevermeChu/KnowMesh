import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { cache } from 'react';
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
  await auth.protect();
  const user = await currentUser();

  if (!user) {
    return [];
  }

  const verifiedEmails = user.emailAddresses
    .filter((emailAddress) => emailAddress.verification?.status === 'verified')
    .map((emailAddress) => emailAddress.emailAddress.toLowerCase());

  if (verifiedEmails.length === 0) {
    return [];
  }

  return await db
    .select({
      expiresAt: workspaceInvitationsSchema.expiresAt,
      workspaceName: workspacesSchema.name,
    })
    .from(workspaceInvitationsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, workspaceInvitationsSchema.workspaceId))
    .where(
      and(
        inArray(sql`lower(${workspaceInvitationsSchema.email})`, verifiedEmails),
        isNull(workspaceInvitationsSchema.acceptedById),
        isNull(workspaceInvitationsSchema.revokedAt),
        gt(workspaceInvitationsSchema.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(workspaceInvitationsSchema.createdAt))
    .limit(limit);
});
