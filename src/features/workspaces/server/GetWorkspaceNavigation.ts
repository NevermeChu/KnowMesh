import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getProjectPermissionDecision } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import {
  documentsSchema,
  projectMembersSchema,
  projectsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';

/**
 * Returns the projects and documents visible in one workspace navigation section.
 *
 * @param options - Workspace boundary for the navigation query.
 * @returns Accessible projects with their document navigation items.
 */
export async function getWorkspaceNavigation(options: { workspaceId: string }) {
  const { userId } = await auth.protect();
  const projectRows = await db
    .select({
      id: projectsSchema.id,
      name: projectsSchema.name,
      ownerId: projectsSchema.ownerId,
      projectRole: projectMembersSchema.role,
      workspaceRole: workspaceMembersSchema.role,
      workspaceKind: workspacesSchema.kind,
    })
    .from(projectsSchema)
    .innerJoin(workspacesSchema, eq(workspacesSchema.id, projectsSchema.workspaceId))
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
        eq(projectMembersSchema.projectId, projectsSchema.id),
        eq(projectMembersSchema.userId, userId),
      ),
    )
    .where(eq(projectsSchema.workspaceId, options.workspaceId))
    .orderBy(desc(projectsSchema.createdAt));
  const projects = projectRows.flatMap((project) => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: project.ownerId === userId,
      projectRole: project.projectRole,
      workspaceRole: project.workspaceRole,
      workspaceKind: project.workspaceKind,
    });

    return decision.permissions.includes('project.structure.read')
      ? [
          {
            id: project.id,
            name: project.name,
            permissions: decision.permissions,
            workspaceKind: project.workspaceKind,
          },
        ]
      : [];
  });
  const documentProjectIds = projects.map((project) => project.id);

  if (documentProjectIds.length === 0) {
    return { documents: [], projects };
  }

  const documents = await db
    .select({
      id: documentsSchema.id,
      projectId: documentsSchema.projectId,
      title: documentsSchema.title,
    })
    .from(documentsSchema)
    .where(inArray(documentsSchema.projectId, documentProjectIds))
    .orderBy(desc(documentsSchema.updatedAt));

  return { documents, projects };
}
