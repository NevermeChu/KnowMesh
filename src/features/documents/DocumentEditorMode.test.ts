import { describe, expect, it } from 'vitest';
import { getDocumentEditorMode } from './DocumentEditorMode';

describe(getDocumentEditorMode, () => {
  it('keeps personal documents single-user when collaboration is enabled', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: true,
        workspaceKind: 'personal',
      }),
    ).toBe('single-user');
  });

  it('enables collaboration for team documents behind the feature flag', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: true,
        workspaceKind: 'team',
      }),
    ).toBe('collaborative');
  });

  it('downgrades team documents to a read-only snapshot', () => {
    expect(
      getDocumentEditorMode({
        collaborationEnabled: false,
        workspaceKind: 'team',
      }),
    ).toBe('collaborative-readonly');
  });
});
