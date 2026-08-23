import { describe, expect, it } from 'vitest';
import {
  getDocumentCollaborationCanEdit,
  getDocumentCollaborationCanEditTitle,
  getDocumentCollaborationMembers,
  getDocumentCollaborationState,
} from './DocumentCollaborationClientState';

describe('document collaboration client state', () => {
  it('prioritizes authentication failures over connection state', () => {
    expect(
      getDocumentCollaborationState({
        authenticationFailed: true,
        connectionStatus: 'connected',
        hasDisconnected: false,
        syncStatus: 'synced',
      }),
    ).toBe('error');
  });

  it('filters invalid and duplicate presence identities', () => {
    expect(
      getDocumentCollaborationMembers([
        { clientId: 1, user: { id: 'user-1', name: 'Member' } },
        { clientId: 2, user: { name: 'Missing ID' } },
        { clientId: 3, user: { id: 'user-1', name: 'Member' } },
      ]),
    ).toStrictEqual([
      {
        clientId: 1,
        color: expect.stringMatching(/^#/u),
        id: 'user-1',
        name: 'Member',
      },
    ]);
  });

  it('allows editing only for writable authenticated scopes', () => {
    expect(getDocumentCollaborationCanEdit({ canEdit: true, scope: 'read-write' })).toBeTruthy();
    expect(getDocumentCollaborationCanEdit({ canEdit: true, scope: 'readonly' })).toBeFalsy();
    expect(getDocumentCollaborationCanEdit({ canEdit: false, scope: 'read-write' })).toBeFalsy();
  });

  it('revokes title editing after authentication failure', () => {
    expect(
      getDocumentCollaborationCanEditTitle({ authenticationFailed: true, canEdit: true }),
    ).toBeFalsy();
  });
});
