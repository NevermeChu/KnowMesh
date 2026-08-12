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

export type PermissionGroup = {
  id: string;
  members: PermissionMember[];
  name: string;
};

export type PermissionOverview =
  | {
      description: string;
      groups: PermissionGroup[];
      permissions: Permission[];
      scope: 'workspace';
      title: string;
      workspaceId: string;
    }
  | {
      groups: PermissionGroup[];
      permissions: Permission[];
      project: { id: string; name: string };
      scope: 'project';
      workspaceMembers: PermissionMember[];
    }
  | {
      document: { id: string; title: string };
      groups: PermissionGroup[];
      permissions: Permission[];
      project: { id: string; name: string };
      scope: 'document';
    };
