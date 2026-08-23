import type { DocumentEditorMode } from './Document';

export function getDocumentEditorMode(options: {
  collaborationEnabled: boolean;
  workspaceKind: 'personal' | 'team';
}): DocumentEditorMode {
  if (options.workspaceKind !== 'team') {
    return 'single-user';
  }

  if (options.collaborationEnabled) {
    return 'collaborative';
  }

  return 'collaborative-readonly';
}
