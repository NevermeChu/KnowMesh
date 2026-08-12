import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { getProjectAuthorization } from '@/features/permissions/server/ProjectAuthorization';
import type { WorkspaceKind } from '@/features/workspaces/Workspace';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';

export async function getProjectDocuments(options: {
  documentId?: string;
  projectId: string;
  workspaceId: string;
  workspaceKind: WorkspaceKind;
}) {
  const { userId } = await auth.protect();
  const authorization = await getProjectAuthorization({ projectId: options.projectId, userId });

  if (
    !authorization?.decision.permissions.includes('project.read') ||
    authorization.project.workspaceId !== options.workspaceId ||
    authorization.project.workspaceKind !== options.workspaceKind
  ) {
    return null;
  }

  const documentMetadata = await db
    .select({
      createdAt: documentsSchema.createdAt,
      id: documentsSchema.id,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
    })
    .from(documentsSchema)
    .where(eq(documentsSchema.projectId, options.projectId))
    .orderBy(desc(documentsSchema.updatedAt));

  const documents = documentMetadata.map((document) => ({
    id: document.id,
    title: document.title,
  }));
  const selectedMetadata = options.documentId
    ? documentMetadata.find((document) => document.id === options.documentId)
    : undefined;

  if (!selectedMetadata) {
    return { access: authorization.decision, documents, selectedDocument: null };
  }

  const [selectedContent] = await db
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
    .limit(1);

  return {
    access: authorization.decision,
    documents,
    selectedDocument: selectedContent ? { ...selectedMetadata, ...selectedContent } : null,
  };
}
