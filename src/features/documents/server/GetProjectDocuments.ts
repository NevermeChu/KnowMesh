import 'server-only';
import { and, asc, desc, eq } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { getProjectAuthorization } from '@/features/permissions/server/ProjectAuthorization';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { documentsSchema, starredDocumentsSchema } from '@/models/Schema';
import type { DocumentBreadcrumbItem } from '../Document';
import { getDocumentEditorMode } from '../DocumentEditorMode';

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

  const documentMetadata = await db
    .select({
      createdAt: documentsSchema.createdAt,
      id: documentsSchema.id,
      parentId: documentsSchema.parentId,
      sortOrder: documentsSchema.sortOrder,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
    })
    .from(documentsSchema)
    .where(eq(documentsSchema.projectId, options.projectId))
    .orderBy(asc(documentsSchema.sortOrder), desc(documentsSchema.updatedAt));

  const documents = documentMetadata.map((document) => ({
    id: document.id,
    parentId: document.parentId,
    sortOrder: document.sortOrder,
    title: document.title,
  }));
  const selectedMetadata = options.documentId
    ? documentMetadata.find((document) => document.id === options.documentId)
    : undefined;

  if (!selectedMetadata) {
    return {
      access: authorization.decision,
      documents,
      selectedDocumentEditorMode: null,
      selectedDocument: null,
      selectedDocumentTitle: null,
    };
  }

  if (!authorization.decision.permissions.includes('document.read')) {
    return {
      access: authorization.decision,
      documents,
      selectedDocumentEditorMode: null,
      selectedDocument: null,
      selectedDocumentTitle: selectedMetadata.title,
    };
  }

  const areaHref = options.workspaceKind === 'personal' ? '/personal' : '/collaboration';
  const breadcrumbs: DocumentBreadcrumbItem[] = [];
  const metadataById = new Map(documentMetadata.map((doc) => [doc.id, doc]));
  let currentParentId = selectedMetadata.parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break;
    }
    visited.add(currentParentId);

    const parent = metadataById.get(currentParentId);
    if (!parent) {
      break;
    }

    breadcrumbs.unshift({
      href: `${areaHref}?project=${options.projectId}&document=${parent.id}`,
      id: parent.id,
      title: parent.title,
    });
    currentParentId = parent.parentId;
  }

  const [[selectedContent], [starredRecord]] = await Promise.all([
    db
      .select({
        content: documentsSchema.content,
        contentSchemaVersion: documentsSchema.contentSchemaVersion,
        projectId: documentsSchema.projectId,
      })
      .from(documentsSchema)
      .where(
        and(
          eq(documentsSchema.id, selectedMetadata.id),
          eq(documentsSchema.projectId, options.projectId),
        ),
      )
      .limit(1),
    db
      .select({ documentId: starredDocumentsSchema.documentId })
      .from(starredDocumentsSchema)
      .where(
        and(
          eq(starredDocumentsSchema.userId, userId),
          eq(starredDocumentsSchema.documentId, selectedMetadata.id),
        ),
      )
      .limit(1),
  ]);

  return {
    access: authorization.decision,
    documents,
    selectedDocumentEditorMode: selectedContent
      ? getDocumentEditorMode({
          collaborationEnabled: Env.COLLABORATION_ENABLED === 'true',
          workspaceKind: options.workspaceKind,
        })
      : null,
    selectedDocument: selectedContent
      ? {
          breadcrumbs,
          content: selectedContent.content,
          contentSchemaVersion: selectedContent.contentSchemaVersion,
          projectId: selectedContent.projectId,
          projectName: authorization.project.name,
          ...selectedMetadata,
          isStarred: Boolean(starredRecord),
        }
      : null,
    selectedDocumentTitle: selectedMetadata.title,
  };
}
