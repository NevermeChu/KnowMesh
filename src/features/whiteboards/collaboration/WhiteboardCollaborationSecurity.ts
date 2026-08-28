import { getDocumentCollaborationIdentity } from '@/features/documents/collaboration/DocumentCollaborationAuthentication';
import {
  getDocumentCollaborationAccess,
  isDocumentCollaborationSessionActive,
} from '@/features/documents/collaboration/DocumentCollaborationAuthorization';
import { whiteboardCollaborationHandshakeSchema } from './WhiteboardCollaborationProtocol';
import type { WhiteboardSocketData } from './WhiteboardCollaborationProtocol';

export async function authenticateWhiteboardCollaborationConnection(options: {
  auth: unknown;
  requestHeaders: Headers;
}): Promise<WhiteboardSocketData> {
  const identity = await getDocumentCollaborationIdentity(options.requestHeaders);
  if (!identity) {
    throw new Error('permission-denied');
  }
  const { documentId } = whiteboardCollaborationHandshakeSchema.parse(options.auth);
  const access = await getDocumentCollaborationAccess({ documentId, userId: identity.userId });
  if (!access || access.documentKind !== 'whiteboard') {
    throw new Error('permission-denied');
  }
  return { ...identity, ...access, accessValidatedAt: Date.now(), documentId };
}

export async function revalidateWhiteboardCollaborationConnection(context: WhiteboardSocketData) {
  if (
    !(await isDocumentCollaborationSessionActive({
      sessionId: context.sessionId,
      userId: context.userId,
    }))
  ) {
    return false;
  }
  const access = await getDocumentCollaborationAccess({
    documentId: context.documentId,
    userId: context.userId,
  });
  return (
    access?.documentKind === 'whiteboard' &&
    access.canWrite === context.canWrite &&
    access.projectId === context.projectId
  );
}
