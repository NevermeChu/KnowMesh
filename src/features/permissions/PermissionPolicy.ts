import type { ProjectKind } from '@/features/projects/Project';
import type { MemberRole, Permission, PermissionDecision, PermissionGrant } from './Permission';

const workspacePermissions: Record<MemberRole, Permission[]> = {
  editor: ['workspace.read', 'project.create'],
  owner: [
    'workspace.read',
    'workspace.update',
    'workspace.delete',
    'workspace.members.manage',
    'project.create',
  ],
  viewer: ['workspace.read'],
};

const projectPermissions: Record<MemberRole, Permission[]> = {
  editor: [
    'project.read',
    'project.update',
    'document.read',
    'document.create',
    'document.update',
    'document.delete',
  ],
  owner: [
    'project.read',
    'project.update',
    'project.delete',
    'project.members.manage',
    'document.read',
    'document.create',
    'document.update',
    'document.delete',
  ],
  viewer: ['project.read', 'document.read'],
};

const inheritedCollaborationPermissions: Record<MemberRole, Permission[]> = {
  editor: [
    'project.read',
    'project.update',
    'document.read',
    'document.create',
    'document.update',
    'document.delete',
  ],
  owner: [
    'project.read',
    'project.update',
    'project.delete',
    'project.members.manage',
    'document.read',
    'document.create',
    'document.update',
    'document.delete',
  ],
  viewer: ['project.read', 'document.read'],
};

export function getWorkspacePermissions(role: MemberRole) {
  return workspacePermissions[role];
}

export function getProjectPermissionDecision(options: {
  isProjectOwner: boolean;
  kind: ProjectKind;
  projectRole: MemberRole | null;
  workspaceRole: MemberRole;
}): PermissionDecision {
  const grants: PermissionGrant[] = [];
  const resolvedPermissions = new Set<Permission>();

  if (options.projectRole) {
    grants.push({ role: options.projectRole, source: 'project' as const });
    for (const permission of projectPermissions[options.projectRole]) {
      resolvedPermissions.add(permission);
    }
  }

  if (options.kind === 'collaboration') {
    grants.push({ role: options.workspaceRole, source: 'workspace' as const });
    for (const permission of inheritedCollaborationPermissions[options.workspaceRole]) {
      resolvedPermissions.add(permission);
    }
  }

  if (options.isProjectOwner) {
    for (const permission of projectPermissions.owner) {
      resolvedPermissions.add(permission);
    }
  }

  return {
    grants,
    isResourceOwner: options.isProjectOwner,
    permissions: [...resolvedPermissions],
  };
}

export function hasPermission(decision: PermissionDecision, permission: Permission) {
  return decision.permissions.includes(permission);
}
