import { describe, expect, it } from 'vitest';
import { getDocumentEditorMode } from './DocumentEditorMode';

describe(getDocumentEditorMode, () => {
  it('keeps personal documents single-user when collaboration is enabled', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: true,
        hasCollaborationState: false,
        workspaceKind: 'personal',
      }),
    ).toBe('single-user');
  });

  it('enables collaboration for team documents behind the feature flag', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: true,
        hasCollaborationState: false,
        workspaceKind: 'team',
      }),
    ).toBe('collaborative');
  });

  it('downgrades initialized team documents to a read-only snapshot', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: false,
        hasCollaborationState: true,
        workspaceKind: 'team',
      }),
    ).toBe('collaborative-readonly');
  });

  it('keeps uninitialized team documents single-user when collaboration is disabled', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: false,
        hasCollaborationState: false,
        workspaceKind: 'team',
      }),
    ).toBe('single-user');
  });
});
