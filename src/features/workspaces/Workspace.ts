import type { ProjectMemberRole } from '@/features/projects/Project';

export const ACTIVE_WORKSPACE_COOKIE = 'knowmesh-active-workspace';

export type Workspace = {
  createdAt: Date;
  id: string;
  name: string;
  role: ProjectMemberRole;
  updatedAt: Date;
};
