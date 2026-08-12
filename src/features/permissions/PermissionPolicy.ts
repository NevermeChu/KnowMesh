import type { WorkspaceKind } from '@/features/workspaces/Workspace';
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

export function getWorkspacePermissions(role: MemberRole, workspaceKind: WorkspaceKind) {
  if (workspaceKind === 'personal') {
    return role === 'owner'
      ? (['workspace.read', 'workspace.update', 'project.create'] satisfies Permission[])
      : [];
  }

  return workspacePermissions[role];
}

export function getProjectPermissionDecision(options: {
  isProjectOwner: boolean;
  projectRole: MemberRole | null;
  workspaceRole: MemberRole;
  workspaceKind: WorkspaceKind;
}): PermissionDecision {
  const grants: PermissionGrant[] = [];
  const resolvedPermissions = new Set<Permission>();
  const personalOwnerPermissions = projectPermissions.owner.filter(
    (permission) => permission !== 'project.members.manage',
  );

  if (options.workspaceKind === 'personal') {
    if (options.isProjectOwner) {
      grants.push({ role: 'owner', source: 'project' as const });
      for (const permission of personalOwnerPermissions) {
        resolvedPermissions.add(permission);
      }
    }

    return {
      grants,
      isResourceOwner: options.isProjectOwner,
      permissions: [...resolvedPermissions],
    };
  }

  if (options.projectRole) {
    grants.push({ role: options.projectRole, source: 'project' as const });
    for (const permission of projectPermissions[options.projectRole]) {
      resolvedPermissions.add(permission);
    }
  }

  grants.push({ role: options.workspaceRole, source: 'workspace' as const });
  for (const permission of projectPermissions[options.workspaceRole]) {
    resolvedPermissions.add(permission);
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
