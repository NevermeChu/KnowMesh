import type { WorkspaceDocument } from '@/components/layout/AppSidebar/SidebarWorkspaceNavigationTypes';
import type {
  DocumentNavigationCursor,
  DocumentNavigationItem,
} from '@/features/documents/Document';

export type NavigationNodeState = {
  error: string | null;
  hasLoadedFirstPage: boolean;
  isLoading: boolean;
  nextCursor: DocumentNavigationCursor | null;
};

export type DocumentNavigationState = {
  documents: DocumentNavigationItem[];
  nodeStates: Record<string, NavigationNodeState>;
};

export type DocumentNavigationAction =
  | { items: DocumentNavigationItem[]; type: 'documents.merge' }
  | { parentId: string; hasChildren: boolean; type: 'documents.setParentHasChildren' }
  | { parentId: string | null; projectId: string; type: 'node.invalidate' }
  | { key: string; state: NavigationNodeState; type: 'node.setState' }
  | { projectIds: string[]; type: 'projects.retain' };

export const emptyNavigationNodeState: NavigationNodeState = {
  error: null,
  hasLoadedFirstPage: false,
  isLoading: false,
  nextCursor: null,
};

export const initialDocumentNavigationState: DocumentNavigationState = {
  documents: [],
  nodeStates: {},
};

export const getNavigationNodeKey = (projectId: string, parentId: string | null) =>
  `${projectId}:${parentId ?? 'root'}`;

export const compareDocuments = (left: WorkspaceDocument, right: WorkspaceDocument) =>
  left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);

export const getExpandedDocumentIdsForPath = (path: DocumentNavigationItem[]) =>
  Object.fromEntries(path.slice(0, -1).map((document) => [document.id, true]));

export function buildDocumentTree(documents: WorkspaceDocument[]): WorkspaceDocument[] {
  const docMap = new Map<string, WorkspaceDocument>();
  const rootDocuments: WorkspaceDocument[] = [];

  for (const document of documents) {
    docMap.set(document.id, { ...document, children: [] });
  }

  for (const document of documents) {
    const treeNode = docMap.get(document.id);
    if (!treeNode) {
      continue;
    }

    if (document.parentId && docMap.has(document.parentId)) {
      docMap.get(document.parentId)?.children?.push(treeNode);
    } else if (!document.parentId) {
      rootDocuments.push(treeNode);
    }
  }

  rootDocuments.sort(compareDocuments);
  for (const document of docMap.values()) {
    document.children?.sort(compareDocuments);
  }

  return rootDocuments;
}

export function documentNavigationReducer(
  state: DocumentNavigationState,
  action: DocumentNavigationAction,
): DocumentNavigationState {
  switch (action.type) {
    case 'documents.merge': {
      const documentsById = new Map(state.documents.map((document) => [document.id, document]));
      for (const item of action.items) {
        const current = documentsById.get(item.id);
        documentsById.set(item.id, {
          ...current,
          ...item,
          hasChildren: current?.hasChildren === true || item.hasChildren,
        });
      }
      return { ...state, documents: [...documentsById.values()] };
    }
    case 'documents.setParentHasChildren': {
      return {
        ...state,
        documents: state.documents.map((document) =>
          document.id === action.parentId
            ? { ...document, hasChildren: action.hasChildren }
            : document,
        ),
      };
    }
    case 'node.invalidate': {
      const key = getNavigationNodeKey(action.projectId, action.parentId);
      return {
        documents: state.documents.filter(
          (document) =>
            document.projectId !== action.projectId || document.parentId !== action.parentId,
        ),
        nodeStates: { ...state.nodeStates, [key]: emptyNavigationNodeState },
      };
    }
    case 'node.setState': {
      return {
        ...state,
        nodeStates: { ...state.nodeStates, [action.key]: action.state },
      };
    }
    case 'projects.retain': {
      const projectIds = new Set(action.projectIds);
      return {
        documents: state.documents.filter((document) => projectIds.has(document.projectId)),
        nodeStates: Object.fromEntries(
          Object.entries(state.nodeStates).filter(([key]) =>
            action.projectIds.some((projectId) => key.startsWith(`${projectId}:`)),
          ),
        ),
      };
    }
    default: {
      return state;
    }
  }
}

export function createNavigationRequestTracker() {
  const activeRequests = new Map<string, number>();
  const versions = new Map<string, number>();

  return {
    begin(key: string) {
      if (activeRequests.has(key)) {
        return null;
      }
      const version = (versions.get(key) ?? 0) + 1;
      versions.set(key, version);
      activeRequests.set(key, version);
      return version;
    },
    finish(key: string, version: number) {
      if (activeRequests.get(key) === version) {
        activeRequests.delete(key);
      }
    },
    invalidate(key: string) {
      versions.set(key, (versions.get(key) ?? 0) + 1);
      activeRequests.delete(key);
    },
    isCurrent(key: string, version: number) {
      return versions.get(key) === version;
    },
  };
}

export const canApplyNavigationResponse = (options: {
  isCurrentRequest: boolean;
  projectId: string;
  visibleProjectIds: Set<string>;
}) => options.visibleProjectIds.has(options.projectId) && options.isCurrentRequest;
