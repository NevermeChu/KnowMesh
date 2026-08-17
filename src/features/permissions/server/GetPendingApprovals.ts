import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/libs/DB';
import {
  projectAccessRequestsSchema,
  projectsSchema,
  workspaceAccessRequestsSchema,
  workspacesSchema,
} from '@/models/Schema';

export type PendingApprovalItem = {
  createdAt: Date;
  kind: 'workspace' | 'project';
  requestedRole: string;
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
  const { userId } = await auth.protect();

  const [workspaceRequests, projectRequests] = await Promise.all([
    db
      .select({
        createdAt: workspaceAccessRequestsSchema.createdAt,
        requestedRole: workspaceAccessRequestsSchema.requestedRole,
        resourceName: workspacesSchema.name,
      })
      .from(workspaceAccessRequestsSchema)
      .innerJoin(
        workspacesSchema,
        eq(workspacesSchema.id, workspaceAccessRequestsSchema.workspaceId),
      )
      .where(eq(workspacesSchema.ownerId, userId))
      .orderBy(desc(workspaceAccessRequestsSchema.createdAt))
      .limit(limit),
    db
      .select({
        createdAt: projectAccessRequestsSchema.createdAt,
        requestedRole: projectAccessRequestsSchema.requestedRole,
        resourceName: projectsSchema.name,
      })
      .from(projectAccessRequestsSchema)
      .innerJoin(projectsSchema, eq(projectsSchema.id, projectAccessRequestsSchema.projectId))
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
