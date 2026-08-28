import { describe, expect, it } from 'vitest';
import {
  buildDocumentTree,
  canApplyNavigationResponse,
  createNavigationRequestTracker,
  documentNavigationReducer,
  emptyNavigationNodeState,
  getExpandedDocumentIdsForPath,
  getNavigationNodeKey,
  initialDocumentNavigationState,
} from './SidebarDocumentNavigationState';
import type { WorkspaceDocument } from './SidebarWorkspaceNavigationTypes';

const createDocument = (options: {
  id: string;
  parentId?: string | null;
  projectId?: string;
  sortOrder?: number;
}) => ({
  hasChildren: false,
  id: options.id,
  kind: 'rich-text' as const,
  parentId: options.parentId ?? null,
  projectId: options.projectId ?? 'project-1',
  sortOrder: options.sortOrder ?? 0,
  title: options.id,
});

const createWorkspaceDocument = (options: {
  id: string;
  parentId?: string | null;
  sortOrder?: number;
}): WorkspaceDocument => ({
  hasChildren: false,
  href: `/${options.id}`,
  id: options.id,
  kind: 'rich-text',
  label: options.id,
  parentId: options.parentId ?? null,
  sortOrder: options.sortOrder ?? 0,
});

describe(documentNavigationReducer, () => {
  it('merges pages without duplicate documents', () => {
    const firstPage = documentNavigationReducer(initialDocumentNavigationState, {
      items: [createDocument({ id: 'a' }), createDocument({ id: 'b' })],
      type: 'documents.merge',
    });
    const secondPage = documentNavigationReducer(firstPage, {
      items: [{ ...createDocument({ id: 'b' }), hasChildren: true }, createDocument({ id: 'c' })],
      type: 'documents.merge',
    });

    expect(secondPage.documents.map((document) => document.id)).toStrictEqual(['a', 'b', 'c']);
    expect(secondPage.documents.find((document) => document.id === 'b')?.hasChildren).toBeTruthy();
  });

  it('invalidates one node without removing sibling branches', () => {
    const state = {
      documents: [
        createDocument({ id: 'a', parentId: null }),
        createDocument({ id: 'a-child', parentId: 'a' }),
        createDocument({ id: 'b', parentId: null }),
        createDocument({ id: 'b-child', parentId: 'b' }),
      ],
      nodeStates: {
        [getNavigationNodeKey('project-1', 'a')]: {
          ...emptyNavigationNodeState,
          hasLoadedFirstPage: true,
        },
      },
    };

    const result = documentNavigationReducer(state, {
      parentId: 'a',
      projectId: 'project-1',
      type: 'node.invalidate',
    });

    expect(result.documents.map((document) => document.id)).toStrictEqual(['a', 'b', 'b-child']);
    expect(result.nodeStates[getNavigationNodeKey('project-1', 'a')]).toStrictEqual(
      emptyNavigationNodeState,
    );
  });

  it('removes documents and states for hidden projects', () => {
    const result = documentNavigationReducer(
      {
        documents: [
          createDocument({ id: 'visible', projectId: 'project-1' }),
          createDocument({ id: 'hidden', projectId: 'project-2' }),
        ],
        nodeStates: {
          [getNavigationNodeKey('project-1', null)]: emptyNavigationNodeState,
          [getNavigationNodeKey('project-2', null)]: emptyNavigationNodeState,
        },
      },
      { projectIds: ['project-1'], type: 'projects.retain' },
    );

    expect(result.documents.map((document) => document.id)).toStrictEqual(['visible']);
    expect(Object.keys(result.nodeStates)).toStrictEqual([getNavigationNodeKey('project-1', null)]);
  });
});

describe(createNavigationRequestTracker, () => {
  it('deduplicates active requests for one node', () => {
    const tracker = createNavigationRequestTracker();
    const firstVersion = tracker.begin('project:root');

    expect(firstVersion).toBe(1);
    expect(tracker.begin('project:root')).toBeNull();
  });

  it('rejects a response after node invalidation', () => {
    const tracker = createNavigationRequestTracker();
    const version = tracker.begin('project:root');
    expect(version).not.toBeNull();
    if (version === null) {
      throw new Error('Expected the first request to start');
    }

    tracker.invalidate('project:root');

    expect(tracker.isCurrent('project:root', version)).toBeFalsy();
    expect(tracker.begin('project:root')).not.toBeNull();
  });
});

describe(canApplyNavigationResponse, () => {
  it('rejects a late response after project removal', () => {
    expect(
      canApplyNavigationResponse({
        isCurrentRequest: true,
        projectId: 'removed-project',
        visibleProjectIds: new Set(['visible-project']),
      }),
    ).toBeFalsy();
  });
});

describe(getExpandedDocumentIdsForPath, () => {
  it('expands ancestors without expanding selected document', () => {
    const path = [
      createDocument({ id: 'root' }),
      createDocument({ id: 'parent', parentId: 'root' }),
      createDocument({ id: 'selected', parentId: 'parent' }),
    ];

    expect(getExpandedDocumentIdsForPath(path)).toStrictEqual({ parent: true, root: true });
  });
});

describe(buildDocumentTree, () => {
  it('omits cycles and orphaned documents from roots', () => {
    const tree = buildDocumentTree([
      createWorkspaceDocument({ id: 'root' }),
      createWorkspaceDocument({ id: 'child', parentId: 'root' }),
      createWorkspaceDocument({ id: 'cycle-a', parentId: 'cycle-b' }),
      createWorkspaceDocument({ id: 'cycle-b', parentId: 'cycle-a' }),
      createWorkspaceDocument({ id: 'orphan', parentId: 'missing' }),
    ]);

    expect(tree.map((document) => document.id)).toStrictEqual(['root']);
    expect(tree[0]?.children?.map((document) => document.id)).toStrictEqual(['child']);
  });
});
