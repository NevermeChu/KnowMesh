import 'server-only';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { getProjectAuthorization } from '@/features/permissions/server/ProjectAuthorization';
import { whiteboardSceneSchema } from '@/features/whiteboards/WhiteboardScene';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  documentWhiteboardStatesSchema,
  documentsSchema,
  starredDocumentsSchema,
} from '@/models/Schema';
import { getDocumentEditorMode } from '../DocumentEditorMode';
import { getDocumentNavigationPath } from './GetDocumentNavigation';

export async function getProjectDocuments(options: {
  documentId?: string;
  projectId: string;
  workspaceId: string;
  workspaceKind: WorkspaceKind;
}) {
  const { id: userId } = await requireUser();
  const authorization = await getProjectAuthorization({ projectId: options.projectId, userId });

  if (
    !authorization?.decision.permissions.includes('project.structure.read') ||
    authorization.project.workspaceId !== options.workspaceId ||
    authorization.project.workspaceKind !== options.workspaceKind
  ) {
    return null;
  }

  const [[firstDocument], navigationPath] = await Promise.all([
    db
      .select({ id: documentsSchema.id })
      .from(documentsSchema)
      .where(eq(documentsSchema.projectId, options.projectId))
      .limit(1),
    options.documentId
      ? getDocumentNavigationPath({
          documentId: options.documentId,
          projectId: options.projectId,
        })
      : null,
  ]);
  const selectedNavigationItem = navigationPath?.at(-1);

  if (!selectedNavigationItem) {
    return {
      access: authorization.decision,
      currentUserId: userId,
      hasDocuments: Boolean(firstDocument),
      selectedDocumentEditorMode: null,
      selectedDocument: null,
      selectedDocumentTitle: null,
    };
  }

  if (!authorization.decision.permissions.includes('document.read')) {
    return {
      access: authorization.decision,
      currentUserId: userId,
      hasDocuments: Boolean(firstDocument),
      selectedDocumentEditorMode: null,
      selectedDocument: null,
      selectedDocumentTitle: selectedNavigationItem.title,
    };
  }

  const starredRecordPromise = db
    .select({ documentId: starredDocumentsSchema.documentId })
    .from(starredDocumentsSchema)
    .where(
      and(
        eq(starredDocumentsSchema.userId, userId),
        eq(starredDocumentsSchema.documentId, selectedNavigationItem.id),
      ),
    )
    .limit(1);

  if (selectedNavigationItem.kind === 'whiteboard') {
    const [[selectedWhiteboard], [starredRecord]] = await Promise.all([
      db
        .select({
          createdAt: documentsSchema.createdAt,
          id: documentsSchema.id,
          parentId: documentsSchema.parentId,
          projectId: documentsSchema.projectId,
          revision: documentWhiteboardStatesSchema.revision,
          scene: documentWhiteboardStatesSchema.scene,
          sceneSchemaVersion: documentWhiteboardStatesSchema.sceneSchemaVersion,
          sceneUpdatedAt: documentWhiteboardStatesSchema.updatedAt,
          sortOrder: documentsSchema.sortOrder,
          title: documentsSchema.title,
          titleVersion: documentsSchema.titleVersion,
          updatedAt: documentsSchema.updatedAt,
        })
        .from(documentsSchema)
        .innerJoin(
          documentWhiteboardStatesSchema,
          eq(documentWhiteboardStatesSchema.documentId, documentsSchema.id),
        )
        .where(
          and(
            eq(documentsSchema.id, selectedNavigationItem.id),
            eq(documentsSchema.kind, 'whiteboard'),
            eq(documentsSchema.projectId, options.projectId),
          ),
        )
        .limit(1),
      starredRecordPromise,
    ]);
    const scene = selectedWhiteboard
      ? whiteboardSceneSchema.parse(selectedWhiteboard.scene)
      : undefined;

    return {
      access: authorization.decision,
      currentUserId: userId,
      hasDocuments: Boolean(firstDocument),
      selectedDocumentEditorMode: null,
      selectedDocument:
        selectedWhiteboard && scene
          ? {
              ...selectedWhiteboard,
              isStarred: Boolean(starredRecord),
              kind: 'whiteboard' as const,
              scene,
            }
          : null,
      selectedDocumentTitle: selectedWhiteboard?.title ?? selectedNavigationItem.title,
    };
  }

  const [[selectedContent], [starredRecord]] = await Promise.all([
    db
      .select({
        content: documentsSchema.content,
        contentSchemaVersion: documentsSchema.contentSchemaVersion,
        createdAt: documentsSchema.createdAt,
        id: documentsSchema.id,
        parentId: documentsSchema.parentId,
        projectId: documentsSchema.projectId,
        sortOrder: documentsSchema.sortOrder,
        title: documentsSchema.title,
        titleVersion: documentsSchema.titleVersion,
        updatedAt: documentsSchema.updatedAt,
      })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.id, selectedNavigationItem.id),
          eq(documentsSchema.kind, 'rich-text'),
          eq(documentsSchema.projectId, options.projectId),
        ),
      )
      .limit(1),
    starredRecordPromise,
  ]);

  return {
    access: authorization.decision,
    currentUserId: userId,
    hasDocuments: Boolean(firstDocument),
    selectedDocumentEditorMode: selectedContent
      ? getDocumentEditorMode({
          collaborationEnabled: Env.COLLABORATION_ENABLED === 'true',
          workspaceKind: options.workspaceKind,
        })
      : null,
    selectedDocument: selectedContent
      ? {
          ...selectedContent,
          isStarred: Boolean(starredRecord),
          kind: 'rich-text' as const,
        }
      : null,
    selectedDocumentTitle: selectedContent?.title ?? selectedNavigationItem.title,
  };
}
