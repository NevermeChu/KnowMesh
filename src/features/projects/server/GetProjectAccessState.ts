import 'server-only';
import { and, eq, gt } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { projectAccessRequestsSchema, projectInvitationsSchema } from '@/models/Schema';

export async function getProjectAccessState(projectId: string) {
  const { id: userId } = await requireUser();
  const authorization = await authorizeProject({
    permission: 'project.structure.read',
    projectId,
    userId,
  });
  const [[invitation], [request]] = await Promise.all([
    db
      .select({ projectId: projectInvitationsSchema.projectId })
      .from(projectInvitationsSchema)
      .where(
        and(
          eq(projectInvitationsSchema.projectId, projectId),
          eq(projectInvitationsSchema.userId, userId),
          gt(projectInvitationsSchema.expiresAt, new Date()),
        ),
      )
      .limit(1),
    db
      .select({ requestedRole: projectAccessRequestsSchema.requestedRole })
      .from(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, projectId),
          eq(projectAccessRequestsSchema.userId, userId),
        ),
      )
      .limit(1),
  ]);

  return {
    hasInvitation: Boolean(invitation),
    projectRole:
      authorization.decision.grants.find((grant) => grant.source === 'project')?.role ?? null,
    requestedRole: request?.requestedRole ?? null,
  };
}
