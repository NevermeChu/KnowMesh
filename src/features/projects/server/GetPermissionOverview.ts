'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { asc, eq, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { memberRoles } from '@/features/permissions/Permission';
import type { MemberRole } from '@/features/permissions/Permission';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import type {
  PermissionGroup,
  PermissionMember,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { db } from '@/libs/DB';
import { projectMembersSchema, workspaceMembersSchema } from '@/models/Schema';

const permissionOverviewInputSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('workspace'), workspaceId: z.uuid() }),
  z.object({ projectId: z.uuid(), scope: z.literal('project') }),
  z.object({ documentId: z.uuid(), scope: z.literal('document') }),
]);

const roleOrder = new Map(memberRoles.map((role, index) => [role, index]));

function mapPermissionMembers(options: {
  currentUserId: string;
  memberships: { role: MemberRole; userId: string }[];
  profiles: Awaited<ReturnType<typeof getClerkProfiles>>;
}) {
  return options.memberships
    .map((membership): PermissionMember => {
      const profile = options.profiles.get(membership.userId);

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
    });
}

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
      members: mapPermissionMembers({
        currentUserId: options.currentUserId,
        memberships: membershipsByProject.get(project.id) ?? [],
        profiles,
      }),
      name: project.name,
    }),
  );
}

async function getWorkspacePermissionGroup(options: {
  currentUserId: string;
  groupId: string;
  groupName: string;
  workspaceId: string;
}) {
  const memberships = await db
    .select({
      role: workspaceMembersSchema.role,
      userId: workspaceMembersSchema.userId,
    })
    .from(workspaceMembersSchema)
    .where(eq(workspaceMembersSchema.workspaceId, options.workspaceId))
    .orderBy(asc(workspaceMembersSchema.createdAt));
  const profiles = await getClerkProfiles(memberships.map((membership) => membership.userId));

  return {
    id: options.groupId,
    members: mapPermissionMembers({
      currentUserId: options.currentUserId,
      memberships,
      profiles,
    }),
    name: options.groupName,
  };
}

async function getProjectPermissionGroups(options: {
  currentUserId: string;
  project: { id: string; name: string; workspaceId: string; workspaceKind: WorkspaceKind };
}) {
  const directGroups = await getPermissionGroups({
    currentUserId: options.currentUserId,
    projects: [{ id: options.project.id, name: '项目直接权限' }],
  });

  if (options.project.workspaceKind === 'personal') {
    return directGroups;
  }

  const workspaceGroup = await getWorkspacePermissionGroup({
    currentUserId: options.currentUserId,
    groupId: `workspace-${options.project.workspaceId}`,
    groupName: '工作区继承权限',
    workspaceId: options.project.workspaceId,
  });

  return [...directGroups, workspaceGroup];
}

/**
 * Returns the authorized permission overview for a workspace, project, or document.
 *
 * @param input - Permission scope and resource identifier.
 * @returns The permission groups visible to the current member.
 * @throws When the current member cannot access the requested resource.
 */
export async function getPermissionOverview(input: PermissionOverviewInput) {
  const { userId } = await auth.protect();
  const permissionInput = permissionOverviewInputSchema.parse(input);

  if (permissionInput.scope === 'workspace') {
    const authorization = await authorizeWorkspace({
      permission: 'workspace.read',
      userId,
      workspaceId: permissionInput.workspaceId,
    });
    const workspaceGroup = await getWorkspacePermissionGroup({
      currentUserId: userId,
      groupId: authorization.workspace.id,
      groupName: authorization.workspace.name,
      workspaceId: authorization.workspace.id,
    });

    return {
      description:
        authorization.workspace.kind === 'personal'
          ? '个人空间永久属于当前用户，只承载不参与协作的个人项目。'
          : '团队工作区角色决定工作区操作，并向其中的项目和文件继承。',
      groups: [workspaceGroup],
      permissions: authorization.decision.permissions,
      scope: 'workspace' as const,
      title: authorization.workspace.kind === 'personal' ? '个人空间' : '工作区权限',
      workspaceId: authorization.workspace.id,
    };
  }

  if (permissionInput.scope === 'project') {
    const authorization = await authorizeProject({
      permission: 'project.read',
      projectId: permissionInput.projectId,
      userId,
    });

    const workspaceGroup =
      authorization.project.workspaceKind === 'team'
        ? await getWorkspacePermissionGroup({
            currentUserId: userId,
            groupId: authorization.project.workspaceId,
            groupName: '工作区成员',
            workspaceId: authorization.project.workspaceId,
          })
        : null;

    return {
      groups: await getProjectPermissionGroups({
        currentUserId: userId,
        project: authorization.project,
      }),
      permissions: authorization.decision.permissions,
      project: { id: authorization.project.id, name: authorization.project.name },
      scope: 'project' as const,
      workspaceMembers: workspaceGroup?.members ?? [],
    };
  }

  const authorization = await authorizeDocument({
    documentId: permissionInput.documentId,
    permission: 'document.read',
    userId,
  });

  return {
    document: { id: authorization.document.id, title: authorization.document.title },
    groups: await getProjectPermissionGroups({
      currentUserId: userId,
      project: authorization.project,
    }),
    permissions: authorization.decision.permissions,
    project: { id: authorization.project.id, name: authorization.project.name },
    scope: 'document' as const,
  };
}
