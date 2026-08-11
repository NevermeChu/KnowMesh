import type { LucideIcon } from 'lucide-react';
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
  role: Project['role'];
};

export type WorkspaceSection = {
  href: string;
  id: ProjectKind;
  icon: LucideIcon;
  label: string;
  projects: WorkspaceProject[];
};

export type NavigationContextTarget =
  | { kind: 'project'; project: WorkspaceProject }
  | { document: WorkspaceDocument; kind: 'document'; project: WorkspaceProject };

export type NavigationContextMenu = {
  position: { x: number; y: number };
  target: NavigationContextTarget;
};
