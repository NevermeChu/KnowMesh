import type { LucideIcon } from 'lucide-react';
import type { DocumentKind } from '@/features/documents/Document';
import type { Permission } from '@/features/permissions/Permission';
import type { ProjectArea } from '@/features/projects/Project';

export type WorkspaceDocument = {
  children?: WorkspaceDocument[];
  hasChildren: boolean;
  href: string;
  id: string;
  kind: DocumentKind;
  label: string;
  parentId: string | null;
  sortOrder: number;
};

export type WorkspaceProject = {
  documents: WorkspaceDocument[];
  href: string;
  id: string;
  label: string;
  permissions: Permission[];
};

export type WorkspaceSection = {
  href: string;
  id: ProjectArea;
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
