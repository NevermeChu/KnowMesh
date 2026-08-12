import { memberRoles } from '@/features/permissions/Permission';
import type { MemberRole, Permission } from '@/features/permissions/Permission';

export const projectKinds = ['personal', 'collaboration'] as const;
export const projectMemberRoles = memberRoles;

export type ProjectKind = (typeof projectKinds)[number];
export type ProjectMemberRole = MemberRole;

export type Project = {
  createdAt: Date;
  id: string;
  kind: ProjectKind;
  name: string;
  permissions: Permission[];
  role: ProjectMemberRole;
  updatedAt: Date;
  workspaceId: string;
};
