import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { getProjectPermissionDecision } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspaceMembersSchema,
} from '@/models/Schema';

/**
 * Returns document metadata for the authenticated workspace navigation.
 *
 * @param options - Active workspace boundary.
 * @returns The current member's accessible document navigation items.
 */
export async function getDocumentNavigation(options: { workspaceId: string }) {
  const { userId } = await auth.protect();

  const documents = await db
    .select({
      createdAt: documentsSchema.createdAt,
      id: documentsSchema.id,
      kind: projectsSchema.kind,
      ownerId: projectsSchema.ownerId,
      projectId: documentsSchema.projectId,
      projectRole: projectMembersSchema.role,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
      workspaceRole: workspaceMembersSchema.role,
    })
    .from(documentsSchema)
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .innerJoin(
      workspaceMembersSchema,
      and(
        eq(workspaceMembersSchema.workspaceId, projectsSchema.workspaceId),
        eq(workspaceMembersSchema.userId, userId),
      ),
    )
    .leftJoin(
      projectMembersSchema,
      and(
        eq(projectMembersSchema.projectId, documentsSchema.projectId),
        eq(projectMembersSchema.userId, userId),
      ),
    )
    .where(eq(projectsSchema.workspaceId, options.workspaceId))
    .orderBy(desc(documentsSchema.updatedAt));

  return documents.flatMap((document) => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: document.ownerId === userId,
      kind: document.kind,
      projectRole: document.projectRole,
      workspaceRole: document.workspaceRole,
    });

    return decision.permissions.includes('document.read')
      ? [
          {
            createdAt: document.createdAt,
            id: document.id,
            projectId: document.projectId,
            title: document.title,
            updatedAt: document.updatedAt,
          },
        ]
      : [];
  });
}
