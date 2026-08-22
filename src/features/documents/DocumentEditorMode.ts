import type { DocumentEditorMode } from './Document';

export function getDocumentEditorMode(options: {
  collaborationEnabled: boolean;
  hasCollaborationState: boolean;
  workspaceKind: 'personal' | 'team';
}): DocumentEditorMode {
  if (options.workspaceKind !== 'team') {
    return 'single-user';
  }

  if (options.collaborationEnabled) {
    return 'collaborative';
  }

  if (options.hasCollaborationState) {
    return 'collaborative-readonly';
  }

  return 'single-user';
}
