'use server';

import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import * as z from 'zod';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { memberRoles } from '@/features/permissions/Permission';
import type { MemberRole } from '@/features/permissions/Permission';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { authorizeProject } from '@/features/permissions/server/ProjectAuthorization';
import { authorizeWorkspace } from '@/features/permissions/server/WorkspaceAuthorization';
import type {
  PermissionGroup,
  PermissionMember,
  PermissionOverviewInput,
  PermissionRequest,
} from '@/features/projects/PermissionOverview';
import { getUserProfiles } from '@/features/users/server/GetUserProfiles';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { db } from '@/libs/DB';
import {
  projectAccessRequestsSchema,
  projectMembersSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
} from '@/models/Schema';

const permissionOverviewInputSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('workspace'), workspaceId: z.uuid() }),
  z.object({ projectId: z.uuid(), scope: z.literal('project') }),
  z.object({ documentId: z.uuid(), scope: z.literal('document') }),
]);

const roleOrder = new Map(memberRoles.map((role, index) => [role, index]));

function mapPermissionMembers(options: {
  currentUserId: string;
  memberships: { role: MemberRole; userId: string }[];
  profiles: Awaited<ReturnType<typeof getUserProfiles>>;
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
  const profiles = await getUserProfiles([
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
      source: 'project',
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
  const profiles = await getUserProfiles(memberships.map((membership) => membership.userId));

  return {
    id: options.groupId,
    members: mapPermissionMembers({
      currentUserId: options.currentUserId,
      memberships,
      profiles,
    }),
    name: options.groupName,
    source: 'workspace' as const,
  };
}

async function getProjectPermissionGroups(options: {
  currentUserId: string;
  project: { id: string; name: string; workspaceId: string; workspaceKind: WorkspaceKind };
}) {
  return await getPermissionGroups({
    currentUserId: options.currentUserId,
    projects: [{ id: options.project.id, name: '项目直接权限' }],
  });
}

async function getProjectRequests(options: { currentUserId: string; projectId: string }) {
  const requests = await db
    .select({
      requestedRole: projectAccessRequestsSchema.requestedRole,
      userId: projectAccessRequestsSchema.userId,
    })
    .from(projectAccessRequestsSchema)
    .where(eq(projectAccessRequestsSchema.projectId, options.projectId))
    .orderBy(asc(projectAccessRequestsSchema.createdAt));
  const profiles = await getUserProfiles(requests.map((request) => request.userId));

  return requests.map((request): PermissionRequest => {
    const profile = profiles.get(request.userId);
    return {
      displayName: profile?.displayName ?? request.userId,
      email: profile?.email ?? null,
      requestedRole: request.requestedRole,
      userId: request.userId,
    };
  });
}

async function getWorkspaceInvitations(workspaceId: string) {
  return await db
    .select({
      email: workspaceInvitationsSchema.email,
      expiresAt: workspaceInvitationsSchema.expiresAt,
      id: workspaceInvitationsSchema.id,
    })
    .from(workspaceInvitationsSchema)
    .where(
      and(
        eq(workspaceInvitationsSchema.workspaceId, workspaceId),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
        gt(workspaceInvitationsSchema.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(workspaceInvitationsSchema.createdAt));
}

async function getWorkspaceRequests(workspaceId: string) {
  const requests = await db
    .select({
      requestedRole: workspaceAccessRequestsSchema.requestedRole,
      userId: workspaceAccessRequestsSchema.userId,
    })
    .from(workspaceAccessRequestsSchema)
    .where(eq(workspaceAccessRequestsSchema.workspaceId, workspaceId))
    .orderBy(asc(workspaceAccessRequestsSchema.createdAt));
  const profiles = await getUserProfiles(requests.map((request) => request.userId));

  return requests.map((request): PermissionRequest => {
    const profile = profiles.get(request.userId);
    return {
      displayName: profile?.displayName ?? request.userId,
      email: profile?.email ?? null,
      requestedRole: request.requestedRole,
      userId: request.userId,
    };
  });
}

/**
 * Returns the authorized permission overview for a workspace, project, or document.
 *
 * @param input - Permission scope and resource identifier.
 * @returns The permission groups visible to the current member.
 * @throws When the current member cannot access the requested resource.
 */
export async function getPermissionOverview(input: PermissionOverviewInput) {
  const { id: userId } = await requireUser();
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
    const canManageMembers = authorization.decision.permissions.includes(
      'workspace.members.manage',
    );

    return {
      description:
        authorization.workspace.kind === 'personal'
          ? '个人空间只承载不参与协作的个人项目，由当前 owner 管理。'
          : '团队工作区成员可以发现其中的项目和文件结构；项目正文访问由项目直接成员关系控制。',
      groups: [workspaceGroup],
      invitations: canManageMembers
        ? await getWorkspaceInvitations(authorization.workspace.id)
        : [],
      currentUserRole: authorization.workspace.role,
      permissions: authorization.decision.permissions,
      requests: canManageMembers ? await getWorkspaceRequests(authorization.workspace.id) : [],
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
      currentUserRole: authorization.project.projectRole,
      groups: await getProjectPermissionGroups({
        currentUserId: userId,
        project: authorization.project,
      }),
      permissions: authorization.decision.permissions,
      project: { id: authorization.project.id, name: authorization.project.name },
      requests: authorization.decision.permissions.includes('project.members.manage')
        ? await getProjectRequests({
            currentUserId: userId,
            projectId: authorization.project.id,
          })
        : [],
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
    document: {
      id: authorization.document.id,
      title: authorization.document.title,
      titleVersion: authorization.document.titleVersion,
    },
    groups: await getProjectPermissionGroups({
      currentUserId: userId,
      project: authorization.project,
    }),
    permissions: authorization.decision.permissions,
    project: { id: authorization.project.id, name: authorization.project.name },
    scope: 'document' as const,
  };
}
