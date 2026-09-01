'use client';

import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import {
  getDocumentNavigationChildren,
  getDocumentNavigationPath,
} from '@/features/documents/server/GetDocumentNavigation';
import type { Project, ProjectArea } from '@/features/projects/Project';
import {
  canApplyNavigationResponse,
  createNavigationRequestTracker,
  documentNavigationReducer,
  emptyNavigationNodeState,
  getExpandedDocumentIdsForPath,
  getNavigationNodeKey,
  initialDocumentNavigationState,
} from './SidebarDocumentNavigationState';
import type { DocumentNavigationAction } from './SidebarDocumentNavigationState';

export function useSidebarDocumentNavigation(props: {
  onDocumentsChange: (documents: DocumentNavigationItem[]) => void;
  projects: Project[];
  selectedDocumentId?: string;
  selectedProjectId?: string;
}) {
  const selectedProjectArea = props.projects.find(
    (project) => project.id === props.selectedProjectId,
  )?.workspaceKind;
  const projectIdsKey = props.projects.map((project) => project.id).join(':');
  const [state, baseDispatch] = useReducer(
    documentNavigationReducer,
    initialDocumentNavigationState,
  );
  const stateRef = useRef(initialDocumentNavigationState);
  const requestTracker = useRef(createNavigationRequestTracker());
  const pathRequestId = useRef(0);
  const visibleProjectIds = useRef(new Set(props.projects.map((project) => project.id)));
  visibleProjectIds.current = new Set(props.projects.map((project) => project.id));

  const [expandedSections, setExpandedSections] = useState<Record<ProjectArea, boolean>>({
    collaboration: selectedProjectArea === 'team',
    personal: selectedProjectArea === 'personal',
  });
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>(
    props.selectedProjectId ? { [props.selectedProjectId]: true } : {},
  );
  const [expandedDocIds, setExpandedDocIds] = useState<Record<string, boolean>>({});

  const dispatch = (action: DocumentNavigationAction) => {
    stateRef.current = documentNavigationReducer(stateRef.current, action);
    baseDispatch(action);
  };

  const loadDocumentChildren = async (projectId: string, parentId: string | null) => {
    const key = getNavigationNodeKey(projectId, parentId);
    const requestVersion = requestTracker.current.begin(key);
    if (requestVersion === null) {
      return;
    }

    const currentState = stateRef.current.nodeStates[key] ?? emptyNavigationNodeState;
    dispatch({
      key,
      state: { ...currentState, error: null, isLoading: true },
      type: 'node.setState',
    });

    try {
      const page = await getDocumentNavigationChildren({
        cursor: currentState.nextCursor ?? undefined,
        limit: 50,
        parentId,
        projectId,
      });
      if (
        !canApplyNavigationResponse({
          isCurrentRequest: requestTracker.current.isCurrent(key, requestVersion),
          projectId,
          visibleProjectIds: visibleProjectIds.current,
        })
      ) {
        return;
      }
      dispatch({ items: page.items, type: 'documents.merge' });
      if (parentId && !currentState.hasLoadedFirstPage) {
        dispatch({
          hasChildren: page.items.length > 0,
          parentId,
          type: 'documents.setParentHasChildren',
        });
      }
      dispatch({
        key,
        state: {
          error: null,
          hasLoadedFirstPage: true,
          isLoading: false,
          nextCursor: page.nextCursor,
        },
        type: 'node.setState',
      });
    } catch {
      if (
        canApplyNavigationResponse({
          isCurrentRequest: requestTracker.current.isCurrent(key, requestVersion),
          projectId,
          visibleProjectIds: visibleProjectIds.current,
        })
      ) {
        dispatch({
          key,
          state: {
            ...currentState,
            error: '文档导航加载失败',
            isLoading: false,
          },
          type: 'node.setState',
        });
      }
    } finally {
      requestTracker.current.finish(key, requestVersion);
    }
  };

  const reloadDocumentChildren = (projectId: string, parentId: string | null) => {
    const key = getNavigationNodeKey(projectId, parentId);
    requestTracker.current.invalidate(key);
    // Drop in-flight selected-path merges so a later title refresh is not overwritten.
    pathRequestId.current += 1;
    dispatch({ parentId, projectId, type: 'node.invalidate' });
    void loadDocumentChildren(projectId, parentId);
  };

  const loadSelectedDocumentPath = useEffectEvent(async () => {
    const requestId = pathRequestId.current + 1;
    pathRequestId.current = requestId;
    if (!props.selectedDocumentId || !props.selectedProjectId) {
      return;
    }
    const selection = {
      documentId: props.selectedDocumentId,
      projectId: props.selectedProjectId,
    };

    const selectedProject = props.projects.find((project) => project.id === selection.projectId);
    if (!selectedProject) {
      return;
    }

    let path;
    try {
      path = await getDocumentNavigationPath({
        documentId: selection.documentId,
        projectId: selection.projectId,
      });
    } catch {
      return;
    }
    if (pathRequestId.current !== requestId || !path) {
      return;
    }

    dispatch({ items: path, type: 'documents.merge' });
    setExpandedProjectIds((current) => ({
      ...current,
      [selection.projectId]: true,
    }));
    setExpandedSections((current) => ({
      ...current,
      [selectedProject.workspaceKind === 'personal' ? 'personal' : 'collaboration']: true,
    }));
    setExpandedDocIds((current) => ({
      ...current,
      ...getExpandedDocumentIdsForPath(path),
    }));
    void loadDocumentChildren(selection.projectId, null);
    for (const document of path.slice(0, -1)) {
      void loadDocumentChildren(selection.projectId, document.id);
    }
  });

  const notifyDocumentsChange = useEffectEvent((documents: DocumentNavigationItem[]) => {
    props.onDocumentsChange(documents);
  });

  const retainVisibleProjects = useEffectEvent(() => {
    dispatch({
      projectIds: props.projects.map((project) => project.id),
      type: 'projects.retain',
    });
  });

  const syncSelectedProjectNavigation = useEffectEvent(() => {
    if (!props.selectedProjectId) {
      return;
    }

    const selectedProject = props.projects.find(
      (project) => project.id === props.selectedProjectId,
    );
    if (!selectedProject) {
      return;
    }

    const projectId = selectedProject.id;
    setExpandedSections((current) => ({
      ...current,
      [selectedProject.workspaceKind === 'personal' ? 'personal' : 'collaboration']: true,
    }));
    setExpandedProjectIds((current) => ({
      ...current,
      [projectId]: true,
    }));

    if (props.selectedDocumentId) {
      return;
    }

    const key = getNavigationNodeKey(projectId, null);
    const nodeState = stateRef.current.nodeStates[key] ?? emptyNavigationNodeState;
    if (!nodeState.hasLoadedFirstPage && !nodeState.isLoading) {
      void loadDocumentChildren(projectId, null);
    }
  });

  useEffect(() => {
    notifyDocumentsChange(state.documents);
  }, [state.documents]);

  useEffect(() => {
    void loadSelectedDocumentPath();
  }, [projectIdsKey, props.selectedDocumentId, props.selectedProjectId]);

  useEffect(() => {
    syncSelectedProjectNavigation();
  }, [projectIdsKey, props.selectedDocumentId, props.selectedProjectId]);

  useEffect(() => {
    retainVisibleProjects();
  }, [projectIdsKey]);

  return {
    documents: state.documents,
    expandedDocIds,
    expandedProjectIds,
    expandedSections,
    loadDocumentChildren,
    nodeStates: state.nodeStates,
    reloadDocumentChildren,
    setExpandedDocIds,
    setExpandedProjectIds,
    setExpandedSections,
  };
}
