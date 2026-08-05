import type { ProjectKind, ProjectMemberRole } from './Project';

export type PermissionOverviewInput =
  | { kind: ProjectKind; scope: 'workspace' }
  | { projectId: string; scope: 'project' }
  | { documentId: string; scope: 'document' };

export type PermissionMember = {
  displayName: string;
  email: string | null;
  imageUrl: string | null;
  isCurrentUser: boolean;
  role: ProjectMemberRole;
  userId: string;
};

export type PermissionGroup = {
  id: string;
  members: PermissionMember[];
  name: string;
};

export type PermissionOverview = {
  description: string;
  groups: PermissionGroup[];
  title: string;
};
