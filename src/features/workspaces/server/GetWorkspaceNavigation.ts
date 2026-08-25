import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { getProjectPermissionDecision } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import {
  projectMembersSchema,
  projectsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';

/**
 * Returns the projects visible in one workspace navigation section.
 *
 * @param options - Workspace boundary for the navigation query.
 * @returns Accessible project navigation items without eagerly loading documents.
 */
export async function getWorkspaceNavigation(options: { workspaceId: string }) {
  const { id: userId } = await requireUser();
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
  return { projects };
}
