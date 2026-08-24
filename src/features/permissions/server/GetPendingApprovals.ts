import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { cache } from 'react';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { db } from '@/libs/DB';
import {
  projectAccessRequestsSchema,
  projectsSchema,
  userSchema,
  workspaceAccessRequestsSchema,
  workspacesSchema,
} from '@/models/Schema';

export type PendingApprovalItem = {
  createdAt: Date;
  kind: 'workspace' | 'project';
  memberUserId: string;
  requestedRole: string;
  requesterEmail: string;
  requesterName: string;
  resourceId: string;
  resourceName: string;
};

/**
 * Reads access requests awaiting the current user's approval as the owning
 * workspace or project owner. Request rows only exist while pending.
 *
 * @param limit - Maximum number of combined items to return.
 * @returns Newest pending requests across owned workspaces and projects.
 */
export const getPendingApprovals = cache(async (limit = 5): Promise<PendingApprovalItem[]> => {
  const { id: userId } = await requireUser();

  const [workspaceRequests, projectRequests] = await Promise.all([
    db
      .select({
        createdAt: workspaceAccessRequestsSchema.createdAt,
        memberUserId: workspaceAccessRequestsSchema.userId,
        requestedRole: workspaceAccessRequestsSchema.requestedRole,
        requesterEmail: userSchema.email,
        requesterName: userSchema.name,
        resourceId: workspacesSchema.id,
        resourceName: workspacesSchema.name,
      })
      .from(workspaceAccessRequestsSchema)
      .innerJoin(
        workspacesSchema,
        eq(workspacesSchema.id, workspaceAccessRequestsSchema.workspaceId),
      )
      .innerJoin(userSchema, eq(userSchema.id, workspaceAccessRequestsSchema.userId))
      .where(eq(workspacesSchema.ownerId, userId))
      .orderBy(desc(workspaceAccessRequestsSchema.createdAt))
      .limit(limit),
    db
      .select({
        createdAt: projectAccessRequestsSchema.createdAt,
        memberUserId: projectAccessRequestsSchema.userId,
        requestedRole: projectAccessRequestsSchema.requestedRole,
        requesterEmail: userSchema.email,
        requesterName: userSchema.name,
        resourceId: projectsSchema.id,
        resourceName: projectsSchema.name,
      })
      .from(projectAccessRequestsSchema)
      .innerJoin(projectsSchema, eq(projectsSchema.id, projectAccessRequestsSchema.projectId))
      .innerJoin(userSchema, eq(userSchema.id, projectAccessRequestsSchema.userId))
      .where(eq(projectsSchema.ownerId, userId))
      .orderBy(desc(projectAccessRequestsSchema.createdAt))
      .limit(limit),
  ]);

  return [
    ...workspaceRequests.map((request) => ({ ...request, kind: 'workspace' as const })),
    ...projectRequests.map((request) => ({ ...request, kind: 'project' as const })),
  ]
    .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);
});
