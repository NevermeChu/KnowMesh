import type { CollabUser, ConnectionStatus, SyncStatus } from '@hocuspocus/provider-react';
import { getDocumentCollaborationColor } from '../collaboration/DocumentCollaborationPresence';
import type { DocumentCollaborationMember } from './DocumentPresence';
import type { CollaborationState } from './DocumentSaveStatus';

function getPresenceUser(value: unknown) {
  if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value)) {
    return null;
  }
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  return { id: value.id, name: value.name };
}

export function getDocumentCollaborationMembers(users: CollabUser[]) {
  const members: DocumentCollaborationMember[] = [];
  const memberIds = new Set<string>();
  for (const state of users) {
    const user = getPresenceUser(state.user);
    if (user && !memberIds.has(user.id)) {
      memberIds.add(user.id);
      members.push({
        clientId: state.clientId,
        color: getDocumentCollaborationColor(user.id),
        ...user,
      });
    }
  }
  return members;
}

export function getDocumentCollaborationCanEdit(options: {
  canEdit: boolean;
  scope: 'read-write' | 'readonly';
}) {
  return options.canEdit && options.scope === 'read-write';
}

export function getDocumentCollaborationState(options: {
  authenticationFailed: boolean;
  connectionStatus: ConnectionStatus;
  hasDisconnected: boolean;
  syncStatus: SyncStatus;
}): CollaborationState {
  if (options.authenticationFailed) {
    return 'error';
  }
  if (options.connectionStatus === 'connecting') {
    return 'connecting';
  }
  if (options.connectionStatus === 'disconnected') {
    return options.hasDisconnected ? 'offline' : 'connecting';
  }
  return options.syncStatus === 'syncing' ? 'syncing' : 'synced';
}
