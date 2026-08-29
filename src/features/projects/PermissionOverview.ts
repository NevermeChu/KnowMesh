import type { MemberRole, Permission } from '@/features/permissions/Permission';

export type PermissionOverviewInput =
  | { scope: 'workspace'; workspaceId: string }
  | { projectId: string; scope: 'project' }
  | { documentId: string; scope: 'document' };

export function isSamePermissionOverviewInput(
  left: PermissionOverviewInput | null,
  right: PermissionOverviewInput,
) {
  if (!left || left.scope !== right.scope) {
    return false;
  }

  if (left.scope === 'workspace' && right.scope === 'workspace') {
    return left.workspaceId === right.workspaceId;
  }

  if (left.scope === 'project' && right.scope === 'project') {
    return left.projectId === right.projectId;
  }

  return (
    left.scope === 'document' && right.scope === 'document' && left.documentId === right.documentId
  );
}

export type PermissionMember = {
  displayName: string;
  email: string | null;
  imageUrl: string | null;
  isCurrentUser: boolean;
  role: MemberRole;
  userId: string;
};

export type PermissionRequest = {
  displayName: string;
  email: string | null;
  requestedRole: MemberRole;
  userId: string;
};

export type PermissionInvitation = {
  email: string;
  expiresAt: Date;
  id: string;
};

export type PermissionGroup = {
  id: string;
  members: PermissionMember[];
  name: string;
  source: 'project' | 'workspace';
};

export function canMutatePermissionGroupMembers(options: {
  scope: PermissionOverview['scope'];
  source: PermissionGroup['source'];
}) {
  if (options.scope === 'workspace') {
    return options.source === 'workspace';
  }

  return options.scope === 'project' && options.source === 'project';
}

export type PermissionOverview =
  | {
      description: string;
      groups: PermissionGroup[];
      invitations: PermissionInvitation[];
      permissions: Permission[];
      currentUserRole: MemberRole;
      requests: PermissionRequest[];
      scope: 'workspace';
      title: string;
      workspaceId: string;
    }
  | {
      currentUserRole: MemberRole | null;
      groups: PermissionGroup[];
      permissions: Permission[];
      project: { id: string; name: string };
      requests: PermissionRequest[];
      scope: 'project';
      workspaceMembers: PermissionMember[];
    }
  | {
      document: { id: string; parentId: string | null; title: string; titleVersion: number };
      groups: PermissionGroup[];
      permissions: Permission[];
      project: { id: string; name: string };
      scope: 'document';
    };

export function getPermissionOverviewRemovalMode(overview: PermissionOverview) {
  if (overview.scope === 'document') {
    return overview.permissions.includes('document.delete') ? ('delete' as const) : null;
  }

  if (overview.scope === 'workspace') {
    if (overview.permissions.includes('workspace.delete')) {
      return 'delete' as const;
    }

    return overview.currentUserRole === 'owner' ? null : ('leave' as const);
  }

  const directGroupSource = 'project';
  const directMemberRole = overview.groups
    .find((group) => group.source === directGroupSource)
    ?.members.find((member) => member.isCurrentUser)?.role;
  const currentUserRole = overview.currentUserRole ?? directMemberRole;

  if (!currentUserRole) {
    return null;
  }

  return currentUserRole === 'owner' ? ('delete' as const) : ('leave' as const);
}
