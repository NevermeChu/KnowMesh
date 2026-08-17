import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { db } from '@/libs/DB';
import { projectAccessRequestsSchema, projectInvitationsSchema } from '@/models/Schema';

export async function getProjectAccessState(projectId: string) {
  const { userId } = await auth.protect();
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
