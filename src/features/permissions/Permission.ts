export const memberRoles = ['owner', 'editor', 'viewer'] as const;

const permissions = [
  'workspace.read',
  'workspace.update',
  'workspace.delete',
  'workspace.members.manage',
  'project.create',
  'project.read',
  'project.update',
  'project.delete',
  'project.members.manage',
  'document.read',
  'document.create',
  'document.update',
  'document.delete',
] as const;

export type MemberRole = (typeof memberRoles)[number];
export type Permission = (typeof permissions)[number];

export type PermissionGrant = {
  role: MemberRole;
  source: 'project' | 'workspace';
};

export type PermissionDecision = {
  grants: PermissionGrant[];
  isResourceOwner: boolean;
  permissions: Permission[];
};
