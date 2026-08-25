import 'server-only';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { getProjectAuthorization } from '@/features/permissions/server/ProjectAuthorization';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { documentsSchema, starredDocumentsSchema } from '@/models/Schema';
import type { DocumentBreadcrumbItem } from '../Document';
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

  const areaHref = options.workspaceKind === 'personal' ? '/personal' : '/collaboration';
  const breadcrumbs: DocumentBreadcrumbItem[] = (navigationPath ?? [])
    .slice(0, -1)
    .map((document) => ({
      href: `${areaHref}?project=${options.projectId}&document=${document.id}`,
      id: document.id,
      title: document.title,
    }));

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
          eq(starredDocumentsSchema.documentId, selectedNavigationItem.id),
        ),
      )
      .limit(1),
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
          breadcrumbs,
          ...selectedContent,
          projectName: authorization.project.name,
          isStarred: Boolean(starredRecord),
        }
      : null,
    selectedDocumentTitle: selectedContent?.title ?? selectedNavigationItem.title,
  };
}
