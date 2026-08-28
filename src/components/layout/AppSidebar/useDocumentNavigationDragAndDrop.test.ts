import { describe, expect, it } from 'vitest';
import type { WorkspaceDocument } from './SidebarWorkspaceNavigationTypes';
import {
  getDocumentDropPosition,
  getDocumentMoveTargetParentId,
  isDocumentDescendant,
} from './useDocumentNavigationDragAndDrop';

const createDocument = (id: string, parentId: string | null): WorkspaceDocument => ({
  hasChildren: false,
  href: `/${id}`,
  id,
  kind: 'rich-text',
  label: id,
  parentId,
  sortOrder: 0,
});

describe(getDocumentDropPosition, () => {
  it.each([
    { clientY: 124, position: 'before' },
    { clientY: 150, position: 'inside' },
    { clientY: 176, position: 'after' },
  ] as const)('maps clientY $clientY to $position', (options) => {
    expect(getDocumentDropPosition({ clientY: options.clientY, height: 100, top: 100 })).toBe(
      options.position,
    );
  });
});

describe(getDocumentMoveTargetParentId, () => {
  it('uses the target document for an inside drop', () => {
    expect(
      getDocumentMoveTargetParentId({
        position: 'inside',
        targetDocumentId: 'target',
        targetDocumentParentId: 'parent',
      }),
    ).toBe('target');
  });

  it.each(['before', 'after'] as const)('uses the target parent for a %s drop', (position) => {
    expect(
      getDocumentMoveTargetParentId({
        position,
        targetDocumentId: 'target',
        targetDocumentParentId: 'parent',
      }),
    ).toBe('parent');
  });
});

describe(isDocumentDescendant, () => {
  it('finds descendants through loaded ancestors', () => {
    const documents = [
      createDocument('root', null),
      createDocument('child', 'root'),
      createDocument('grandchild', 'child'),
    ];

    expect(
      isDocumentDescendant({ ancestorId: 'root', documents, targetId: 'grandchild' }),
    ).toBeTruthy();
  });

  it('stops when loaded data contains a cycle', () => {
    const documents = [createDocument('a', 'b'), createDocument('b', 'a')];

    expect(isDocumentDescendant({ ancestorId: 'missing', documents, targetId: 'a' })).toBeFalsy();
  });
});
