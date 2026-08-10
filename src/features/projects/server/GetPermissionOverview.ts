'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { asc, eq, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { getDocumentAccess, getProjectAccess } from '@/features/documents/server/DocumentAccess';
import type {
  PermissionGroup,
  PermissionMember,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';
import { projectKinds, projectMemberRoles } from '@/features/projects/Project';
import { db } from '@/libs/DB';
import { documentsSchema, projectMembersSchema, projectsSchema } from '@/models/Schema';
import { getProjects } from './GetProjects';

const permissionOverviewInputSchema = z.discriminatedUnion('scope', [
  z.object({ kind: z.enum(projectKinds), scope: z.literal('workspace'), workspaceId: z.uuid() }),
  z.object({ projectId: z.uuid(), scope: z.literal('project') }),
  z.object({ documentId: z.uuid(), scope: z.literal('document') }),
]);

const roleOrder = new Map(projectMemberRoles.map((role, index) => [role, index]));

async function getClerkProfiles(userIds: string[]) {
  const client = await clerkClient();
  const batches = Array.from({ length: Math.ceil(userIds.length / 100) }, (_, index) =>
    userIds.slice(index * 100, (index + 1) * 100),
  );
  const responses = [];

  for (const userId of batches) {
    responses.push(await client.users.getUserList({ limit: userId.length, userId }));
  }

  return new Map(
    responses
      .flatMap((response) => response.data)
      .map((user) => {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        const primaryEmail = user.emailAddresses.find(
          (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
        )?.emailAddress;
        const displayName =
          fullName.length > 0 ? fullName : (user.username ?? primaryEmail ?? user.id);

        return [
          user.id,
          {
            displayName,
            email: primaryEmail ?? null,
            imageUrl: user.imageUrl ?? null,
          },
        ] as const;
      }),
  );
}

async function getPermissionGroups(options: {
  currentUserId: string;
  projects: { id: string; name: string }[];
}) {
  if (options.projects.length === 0) {
    return [];
  }

  const memberships = await db
    .select({
      projectId: projectMembersSchema.projectId,
      role: projectMembersSchema.role,
      userId: projectMembersSchema.userId,
    })
    .from(projectMembersSchema)
    .where(
      inArray(
        projectMembersSchema.projectId,
        options.projects.map((project) => project.id),
      ),
    )
    .orderBy(asc(projectMembersSchema.createdAt));
  const profiles = await getClerkProfiles([
    ...new Set(memberships.map((membership) => membership.userId)),
  ]);
  const membershipsByProject = Map.groupBy(memberships, (membership) => membership.projectId);

  return options.projects.map(
    (project): PermissionGroup => ({
      id: project.id,
      members: (membershipsByProject.get(project.id) ?? [])
        .map((membership): PermissionMember => {
          const profile = profiles.get(membership.userId);

          return {
            displayName: profile?.displayName ?? membership.userId,
            email: profile?.email ?? null,
            imageUrl: profile?.imageUrl ?? null,
            isCurrentUser: membership.userId === options.currentUserId,
            role: membership.role,
            userId: membership.userId,
          };
        })
        .toSorted((left, right) => {
          const roleDifference =
            (roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER) -
            (roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER);

          return roleDifference || left.displayName.localeCompare(right.displayName, 'zh-CN');
        }),
      name: project.name,
    }),
  );
}

/**
 * Returns the authorized permission overview for a workspace category, project, or document.
 *
 * @param input - Permission scope and resource identifier.
 * @returns The permission groups visible to the current member.
 * @throws When the current member cannot access the requested resource.
 */
export async function getPermissionOverview(input: PermissionOverviewInput) {
  const { userId } = await auth.protect();
  const permissionInput = permissionOverviewInputSchema.parse(input);

  if (permissionInput.scope === 'workspace') {
    const projects = await getProjects({
      kind: permissionInput.kind,
      workspaceId: permissionInput.workspaceId,
    });

    return {
      description: '当前工作区是项目分区，没有独立成员权限。下方按项目展示实际生效的完整权限。',
      groups: await getPermissionGroups({ currentUserId: userId, projects }),
      scope: 'workspace' as const,
      title: `${permissionInput.kind === 'personal' ? '个人工作区' : '协作区'}权限`,
    };
  }

  if (permissionInput.scope === 'project') {
    const access = await getProjectAccess({ projectId: permissionInput.projectId, userId });

    if (!access) {
      throw new Error('没有权限查看该项目');
    }

    return {
      groups: await getPermissionGroups({ currentUserId: userId, projects: [access] }),
      project: { id: access.id, name: access.name },
      scope: 'project' as const,
    };
  }

  const access = await getDocumentAccess({ documentId: permissionInput.documentId, userId });

  if (!access) {
    throw new Error('没有权限查看该文件');
  }

  const [resource] = await db
    .select({
      documentTitle: documentsSchema.title,
      projectId: projectsSchema.id,
      projectName: projectsSchema.name,
    })
    .from(documentsSchema)
    .innerJoin(projectsSchema, eq(projectsSchema.id, documentsSchema.projectId))
    .where(eq(documentsSchema.id, permissionInput.documentId))
    .limit(1);

  if (!resource) {
    throw new Error('文件不存在');
  }

  return {
    document: { id: permissionInput.documentId, title: resource.documentTitle },
    groups: await getPermissionGroups({
      currentUserId: userId,
      projects: [{ id: resource.projectId, name: resource.projectName }],
    }),
    project: { id: resource.projectId, name: resource.projectName },
    scope: 'document' as const,
  };
}
