import { getDocumentCollaborationIdentity } from './DocumentCollaborationAuthentication';
import {
  getDocumentCollaborationAccess,
  isDocumentCollaborationSessionActive,
} from './DocumentCollaborationAuthorization';
import { getDocumentIdFromCollaborationRoom } from './DocumentCollaborationRoom';

export type DocumentCollaborationContext = {
  canWrite: boolean;
  documentId: string;
  image: string | null;
  name: string;
  projectId: string;
  sessionId: string;
  userId: string;
};

export function assertDocumentCollaborationOrigin(options: {
  allowedOrigin: string;
  requestHeaders: Headers;
}) {
  if (options.requestHeaders.get('origin') !== options.allowedOrigin) {
    throw new Error('permission-denied');
  }
}

export async function authenticateDocumentCollaborationConnection(options: {
  documentName: string;
  requestHeaders: Headers;
}) {
  const identity = await getDocumentCollaborationIdentity(options.requestHeaders);
  if (!identity) {
    throw new Error('permission-denied');
  }

  const documentId = getDocumentIdFromCollaborationRoom(options.documentName);
  const access = await getDocumentCollaborationAccess({ documentId, userId: identity.userId });
  if (!access) {
    throw new Error('permission-denied');
  }

  return {
    ...identity,
    ...access,
    documentId,
  } satisfies DocumentCollaborationContext;
}

export async function revalidateDocumentCollaborationConnection(
  context: DocumentCollaborationContext,
) {
  const sessionActive = await isDocumentCollaborationSessionActive({
    sessionId: context.sessionId,
    userId: context.userId,
  });
  if (!sessionActive) {
    return false;
  }

  const access = await getDocumentCollaborationAccess({
    documentId: context.documentId,
    userId: context.userId,
  });

  return access?.canWrite === context.canWrite && access.projectId === context.projectId;
}

export function sanitizeDocumentCollaborationAwareness(options: {
  context: DocumentCollaborationContext;
  states: Map<number, Record<string, unknown>>;
}) {
  for (const [clientId, state] of options.states) {
    options.states.set(clientId, {
      ...state,
      user: {
        id: options.context.userId,
        image: options.context.image,
        name: options.context.name,
      },
    });
  }
}
