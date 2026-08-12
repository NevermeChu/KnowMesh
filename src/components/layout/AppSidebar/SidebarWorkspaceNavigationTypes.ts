import type { LucideIcon } from 'lucide-react';
import type { Permission } from '@/features/permissions/Permission';
import type { Project, ProjectKind } from '@/features/projects/Project';

export type WorkspaceDocument = {
  href: string;
  id: string;
  label: string;
};

export type WorkspaceProject = {
  documents: WorkspaceDocument[];
  href: string;
  id: string;
  label: string;
  permissions: Permission[];
  role: Project['role'];
};

export type WorkspaceSection = {
  href: string;
  id: ProjectKind;
  icon: LucideIcon;
  label: string;
  canCreateProject: boolean;
  projects: WorkspaceProject[];
};

export type NavigationContextTarget =
  | { kind: 'project'; project: WorkspaceProject }
  | { document: WorkspaceDocument; kind: 'document'; project: WorkspaceProject };

export type NavigationContextMenu = {
  position: { x: number; y: number };
  target: NavigationContextTarget;
};
