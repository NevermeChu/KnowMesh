import type { MemberRole, Permission } from '@/features/permissions/Permission';

export const ACTIVE_WORKSPACE_COOKIE = 'knowmesh-active-workspace';

export type Workspace = {
  createdAt: Date;
  id: string;
  name: string;
  permissions: Permission[];
  role: MemberRole;
  updatedAt: Date;
};
