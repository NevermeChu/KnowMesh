import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { getProjectPermissionDecision } from '@/features/permissions/PermissionPolicy';
import { db } from '@/libs/DB';
import { projectMembersSchema, projectsSchema, workspaceMembersSchema } from '@/models/Schema';
import type { ProjectKind } from '../Project';

export async function getProjects(options: { kind?: ProjectKind; workspaceId: string }) {
  const { userId } = await auth.protect();
  const workspaceCondition = eq(projectsSchema.workspaceId, options.workspaceId);
  const projectCondition = options.kind
    ? and(workspaceCondition, eq(projectsSchema.kind, options.kind))
    : workspaceCondition;

  const projects = await db
    .select({
      createdAt: projectsSchema.createdAt,
      id: projectsSchema.id,
      kind: projectsSchema.kind,
      name: projectsSchema.name,
      ownerId: projectsSchema.ownerId,
      projectRole: projectMembersSchema.role,
      updatedAt: projectsSchema.updatedAt,
      workspaceId: projectsSchema.workspaceId,
      workspaceRole: workspaceMembersSchema.role,
    })
    .from(projectsSchema)
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
    .where(projectCondition)
    .orderBy(desc(projectsSchema.createdAt));

  return projects.flatMap((project) => {
    const decision = getProjectPermissionDecision({
      isProjectOwner: project.ownerId === userId,
      kind: project.kind,
      projectRole: project.projectRole,
      workspaceRole: project.workspaceRole,
    });

    if (!decision.permissions.includes('project.read')) {
      return [];
    }

    return [
      {
        createdAt: project.createdAt,
        id: project.id,
        kind: project.kind,
        name: project.name,
        permissions: decision.permissions,
        role:
          project.ownerId === userId
            ? ('owner' as const)
            : (project.projectRole ?? project.workspaceRole),
        updatedAt: project.updatedAt,
        workspaceId: project.workspaceId,
      },
    ];
  });
}
