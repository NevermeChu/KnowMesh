import type { MemberRole, Permission } from '@/features/permissions/Permission';

export const ACTIVE_WORKSPACE_COOKIE = 'knowmesh-active-workspace';
export const workspaceKinds = ['personal', 'team'] as const;

export type WorkspaceKind = (typeof workspaceKinds)[number];

export type Workspace = {
  id: string;
  kind: WorkspaceKind;
  name: string;
  permissions: Permission[];
  role: MemberRole;
};
