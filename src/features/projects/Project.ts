export const projectKinds = ['personal', 'collaboration'] as const;
export const projectMemberRoles = ['owner', 'editor', 'viewer'] as const;

export type ProjectKind = (typeof projectKinds)[number];
export type ProjectMemberRole = (typeof projectMemberRoles)[number];

export type Project = {
  createdAt: Date;
  id: string;
  kind: ProjectKind;
  name: string;
  role: ProjectMemberRole;
  updatedAt: Date;
};
