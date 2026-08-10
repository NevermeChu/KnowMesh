import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import type { ProjectKind } from '@/features/projects/Project';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { getProjectAccess } from './DocumentAccess';

export async function getProjectDocuments(options: {
  documentId?: string;
  kind: ProjectKind;
  projectId: string;
  workspaceId: string;
}) {
  const { userId } = await auth.protect();
  const access = await getProjectAccess({ projectId: options.projectId, userId });

  if (!access || access.kind !== options.kind || access.workspaceId !== options.workspaceId) {
    return null;
  }

  const documents = await db
    .select({
      createdAt: documentsSchema.createdAt,
      id: documentsSchema.id,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
    })
    .from(documentsSchema)
    .where(eq(documentsSchema.projectId, options.projectId))
    .orderBy(desc(documentsSchema.updatedAt));

  const selectedMetadata = options.documentId
    ? documents.find((document) => document.id === options.documentId)
    : undefined;

  if (!selectedMetadata) {
    return { access, documents, selectedDocument: null };
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
    access,
    documents,
    selectedDocument: selectedContent ? { ...selectedMetadata, ...selectedContent } : null,
  };
}
