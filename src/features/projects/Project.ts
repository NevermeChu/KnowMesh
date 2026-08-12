import type { Permission } from '@/features/permissions/Permission';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';

export type ProjectArea = 'collaboration' | 'personal';

export type Project = {
  id: string;
  name: string;
  permissions: Permission[];
  workspaceKind: WorkspaceKind;
};
