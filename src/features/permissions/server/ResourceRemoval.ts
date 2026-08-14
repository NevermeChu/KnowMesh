import 'server-only';
import { and, eq, or } from 'drizzle-orm';
import type { db } from '@/libs/DB';
import {
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectMembersSchema,
  projectsSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';

type ResourceRemovalDatabase = Pick<typeof db, 'delete' | 'select'>;

/**
 * Deletes an owned project or removes one member from a project owned by someone else.
 *
 * @param database - Database or transaction used for the removal.
 * @param options - Project identity, current user, and resolved ownership.
 * @returns Whether the project was deleted or the member left it.
 */
export async function removeProjectForUser(
  database: ResourceRemovalDatabase,
  options: { isOwner: boolean; projectId: string; userId: string },
) {
  if (options.isOwner) {
    const [project] = await database
      .delete(projectsSchema)
      .where(
        and(eq(projectsSchema.id, options.projectId), eq(projectsSchema.ownerId, options.userId)),
      )
      .returning({ id: projectsSchema.id });

    if (!project) {
      throw new Error('项目删除失败');
    }

    return 'deleted' as const;
  }

  await database
    .delete(projectAccessRequestsSchema)
    .where(
      and(
        eq(projectAccessRequestsSchema.projectId, options.projectId),
        eq(projectAccessRequestsSchema.userId, options.userId),
      ),
    );
  await database
    .delete(projectInvitationsSchema)
    .where(
      and(
        eq(projectInvitationsSchema.projectId, options.projectId),
        eq(projectInvitationsSchema.userId, options.userId),
      ),
    );
  const [membership] = await database
    .delete(projectMembersSchema)
    .where(
      and(
        eq(projectMembersSchema.projectId, options.projectId),
        eq(projectMembersSchema.userId, options.userId),
      ),
    )
    .returning({ userId: projectMembersSchema.userId });

  if (!membership) {
    throw new Error('项目退出失败');
  }

  return 'left' as const;
}

/**
 * Deletes an owned workspace or removes one member and their nested project access.
 *
 * @param database - Database or transaction used for the removal.
 * @param options - Workspace identity, current user, and resolved ownership.
 * @returns Whether the workspace was deleted or the member left it.
 */
export async function removeWorkspaceForUser(
  database: ResourceRemovalDatabase,
  options: { isOwner: boolean; userId: string; workspaceId: string },
) {
  if (options.isOwner) {
    const [workspace] = await database
      .delete(workspacesSchema)
      .where(
        and(
          eq(workspacesSchema.id, options.workspaceId),
          eq(workspacesSchema.ownerId, options.userId),
        ),
      )
      .returning({ id: workspacesSchema.id });

    if (!workspace) {
      throw new Error('工作区删除失败');
    }

    return 'deleted' as const;
  }

  const projects = await database
    .select({ id: projectsSchema.id, ownerId: projectsSchema.ownerId })
    .from(projectMembersSchema)
    .innerJoin(projectsSchema, eq(projectsSchema.id, projectMembersSchema.projectId))
    .where(
      and(
        eq(projectsSchema.workspaceId, options.workspaceId),
        eq(projectMembersSchema.userId, options.userId),
      ),
    );

  for (const project of projects) {
    await removeProjectForUser(database, {
      isOwner: project.ownerId === options.userId,
      projectId: project.id,
      userId: options.userId,
    });
  }

  await database
    .delete(workspaceInvitationsSchema)
    .where(
      and(
        eq(workspaceInvitationsSchema.workspaceId, options.workspaceId),
        or(
          eq(workspaceInvitationsSchema.invitedById, options.userId),
          eq(workspaceInvitationsSchema.acceptedById, options.userId),
        ),
      ),
    );
  await database
    .delete(workspaceAccessRequestsSchema)
    .where(
      and(
        eq(workspaceAccessRequestsSchema.workspaceId, options.workspaceId),
        eq(workspaceAccessRequestsSchema.userId, options.userId),
      ),
    );
  const [membership] = await database
    .delete(workspaceMembersSchema)
    .where(
      and(
        eq(workspaceMembersSchema.workspaceId, options.workspaceId),
        eq(workspaceMembersSchema.userId, options.userId),
      ),
    )
    .returning({ userId: workspaceMembersSchema.userId });

  if (!membership) {
    throw new Error('工作区退出失败');
  }

  return 'left' as const;
}
