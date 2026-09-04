'use server';

import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { DOCUMENT_CONTENT_SCHEMA_VERSION } from '@/features/documents/Document';
import { isDocumentContent } from '@/features/documents/DocumentSchema';
import { updateDocument } from '@/features/documents/server/UpdateDocument';
import { AuthorizationError } from '@/features/permissions/AuthorizationError';
import type { Permission } from '@/features/permissions/Permission';
import { authorizeDocument } from '@/features/permissions/server/DocumentAuthorization';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { readPersonalDocumentInputSchema, writePersonalDocumentInputSchema } from '../WebMcpSchema';

async function requirePersonalDocumentAuthorization(options: {
  documentId: string;
  permission: Permission;
}) {
  const { id: userId } = await requireUser();
  const authorization = await authorizeDocument({
    documentId: options.documentId,
    permission: options.permission,
    userId,
  });

  if (authorization.project.workspaceKind !== 'personal') {
    throw new AuthorizationError();
  }

  return authorization;
}

/**
 * Reads one authorized Personal rich-text document for WebMCP.
 *
 * @param input - Untrusted WebMCP tool input.
 * @returns The document content and optimistic concurrency version.
 * @throws AuthorizationError when the document is not an accessible Personal rich-text document.
 */
export async function readPersonalDocument(input: unknown) {
  const documentInput = readPersonalDocumentInputSchema.parse(input);
  const authorization = await requirePersonalDocumentAuthorization({
    documentId: documentInput.documentId,
    permission: 'document.read',
  });
  const [document] = await db
    .select({
      content: documentsSchema.content,
      contentSchemaVersion: documentsSchema.contentSchemaVersion,
      documentId: documentsSchema.id,
      title: documentsSchema.title,
      updatedAt: documentsSchema.updatedAt,
    })
    .from(documentsSchema)
    .where(
      and(
        eq(documentsSchema.id, documentInput.documentId),
        eq(documentsSchema.kind, 'rich-text'),
        eq(documentsSchema.projectId, authorization.document.projectId),
      ),
    )
    .limit(1);

  if (!document) {
    throw new AuthorizationError();
  }

  if (
    document.contentSchemaVersion !== DOCUMENT_CONTENT_SCHEMA_VERSION ||
    !isDocumentContent(document.content)
  ) {
    throw new Error('文档内容版本不受支持');
  }

  return {
    content: document.content,
    contentSchemaVersion: document.contentSchemaVersion,
    documentId: document.documentId,
    title: document.title,
    updatedAt: document.updatedAt.toISOString(),
  };
}

/**
 * Replaces one authorized Personal rich-text document body through the existing save path.
 *
 * @param input - Untrusted WebMCP tool input.
 * @returns The save status and new optimistic concurrency version.
 * @throws AuthorizationError when the document is not an editable Personal document.
 */
export async function writePersonalDocument(input: unknown) {
  const documentInput = writePersonalDocumentInputSchema.parse(input);
  await requirePersonalDocumentAuthorization({
    documentId: documentInput.documentId,
    permission: 'document.update',
  });
  const result = await updateDocument({
    content: documentInput.content,
    documentId: documentInput.documentId,
    expectedUpdatedAt: new Date(documentInput.expectedUpdatedAt),
  });

  if (result.status === 'conflict') {
    return result;
  }

  return {
    status: result.status,
    updatedAt: result.updatedAt.toISOString(),
  };
}
