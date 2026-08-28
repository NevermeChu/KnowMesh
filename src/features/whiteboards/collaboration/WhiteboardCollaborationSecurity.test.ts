import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteboardSocketData } from './WhiteboardCollaborationProtocol';
import {
  authenticateWhiteboardCollaborationConnection,
  revalidateWhiteboardCollaborationConnection,
} from './WhiteboardCollaborationSecurity';

const state = vi.hoisted(() => ({
  getAccess: vi.fn<
    (options: { documentId: string; userId: string }) => Promise<{
      canWrite: boolean;
      documentKind: 'rich-text' | 'whiteboard';
      projectId: string;
    } | null>
  >(),
  getIdentity:
    vi.fn<
      (
        headers: Headers,
      ) => Promise<{ image: string | null; name: string; sessionId: string; userId: string } | null>
    >(),
  isSessionActive: vi.fn<(options: { sessionId: string; userId: string }) => Promise<boolean>>(),
}));

vi.mock(import('@/features/documents/collaboration/DocumentCollaborationAuthentication'), () => ({
  getDocumentCollaborationIdentity: state.getIdentity,
}));
vi.mock(import('@/features/documents/collaboration/DocumentCollaborationAuthorization'), () => ({
  getDocumentCollaborationAccess: state.getAccess,
  isDocumentCollaborationSessionActive: state.isSessionActive,
}));

const context: WhiteboardSocketData = {
  accessValidatedAt: Date.now(),
  canWrite: false,
  documentId: '30000000-0000-4000-8000-000000000061',
  image: null,
  name: 'Viewer',
  projectId: '20000000-0000-4000-8000-000000000061',
  sessionId: 'session-1',
  userId: 'user-1',
};

describe('whiteboard collaboration security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects connections without a verified session', async () => {
    state.getIdentity.mockResolvedValue(null);

    await expect(
      authenticateWhiteboardCollaborationConnection({
        auth: { documentId: context.documentId },
        requestHeaders: new Headers(),
      }),
    ).rejects.toThrow('permission-denied');
    expect(state.getAccess).not.toHaveBeenCalled();
  });

  it('rejects rich-text documents from the whiteboard protocol', async () => {
    state.getIdentity.mockResolvedValue({
      image: null,
      name: context.name,
      sessionId: context.sessionId,
      userId: context.userId,
    });
    state.getAccess.mockResolvedValue({
      canWrite: true,
      documentKind: 'rich-text',
      projectId: context.projectId,
    });

    await expect(
      authenticateWhiteboardCollaborationConnection({
        auth: { documentId: context.documentId },
        requestHeaders: new Headers(),
      }),
    ).rejects.toThrow('permission-denied');
  });

  it('derives read-only access from server authorization', async () => {
    state.getIdentity.mockResolvedValue({
      image: null,
      name: context.name,
      sessionId: context.sessionId,
      userId: context.userId,
    });
    state.getAccess.mockResolvedValue({
      canWrite: false,
      documentKind: 'whiteboard',
      projectId: context.projectId,
    });

    await expect(
      authenticateWhiteboardCollaborationConnection({
        auth: { documentId: context.documentId },
        requestHeaders: new Headers(),
      }),
    ).resolves.toMatchObject({
      canWrite: false,
      documentId: context.documentId,
      projectId: context.projectId,
      userId: context.userId,
    });
  });

  it('invalidates revoked sessions before permission lookup', async () => {
    state.isSessionActive.mockResolvedValue(false);

    await expect(revalidateWhiteboardCollaborationConnection(context)).resolves.toBeFalsy();
    expect(state.getAccess).not.toHaveBeenCalled();
  });
});
