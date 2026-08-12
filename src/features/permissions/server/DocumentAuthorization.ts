import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { documentsSchema } from '@/models/Schema';
import { AuthorizationError } from '../AuthorizationError';
import type { Permission } from '../Permission';
import { getProjectAuthorization } from './ProjectAuthorization';

async function getDocumentAuthorization(options: { documentId: string; userId: string }) {
  const [document] = await db
    .select({
      id: documentsSchema.id,
      projectId: documentsSchema.projectId,
      title: documentsSchema.title,
    })
    .from(documentsSchema)
    .where(eq(documentsSchema.id, options.documentId))
    .limit(1);

  if (!document) {
    return null;
  }

  const projectAuthorization = await getProjectAuthorization({
    projectId: document.projectId,
    userId: options.userId,
  });

  if (!projectAuthorization) {
    return null;
  }

  return { ...projectAuthorization, document };
}

export async function authorizeDocument(options: {
  documentId: string;
  permission: Permission;
  userId: string;
}) {
  const authorization = await getDocumentAuthorization(options);

  if (!authorization?.decision.permissions.includes(options.permission)) {
    throw new AuthorizationError();
  }

  return authorization;
}
