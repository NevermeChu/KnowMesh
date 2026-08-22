import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertDocumentCollaborationOrigin,
  authenticateDocumentCollaborationConnection,
  revalidateDocumentCollaborationConnection,
  sanitizeDocumentCollaborationAwareness,
} from './DocumentCollaborationSecurity';
import type { DocumentCollaborationContext } from './DocumentCollaborationSecurity';

const state = vi.hoisted(() => ({
  getAccess:
    vi.fn<
      (options: {
        documentId: string;
        userId: string;
      }) => Promise<{ canWrite: boolean; projectId: string } | null>
    >(),
  getIdentity:
    vi.fn<
      (
        headers: Headers,
      ) => Promise<{ image: string | null; name: string; sessionId: string; userId: string } | null>
    >(),
  isSessionActive: vi.fn<(options: { sessionId: string; userId: string }) => Promise<boolean>>(),
}));

vi.mock(import('./DocumentCollaborationAuthentication'), () => ({
  getDocumentCollaborationIdentity: state.getIdentity,
}));
vi.mock(import('./DocumentCollaborationAuthorization'), () => ({
  getDocumentCollaborationAccess: state.getAccess,
  isDocumentCollaborationSessionActive: state.isSessionActive,
}));

const context: DocumentCollaborationContext = {
  canWrite: false,
  documentId: '30000000-0000-4000-8000-000000000001',
  image: null,
  name: 'Viewer',
  projectId: '20000000-0000-4000-8000-000000000001',
  sessionId: 'session-1',
  userId: 'user-1',
};

describe('document collaboration security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects cross-origin connections', () => {
    expect(() => {
      assertDocumentCollaborationOrigin({
        allowedOrigin: 'https://knowmesh.example',
        requestHeaders: new Headers({ origin: 'https://attacker.example' }),
      });
    }).toThrow('permission-denied');
  });

  it('rejects connections without a verified session', async () => {
    state.getIdentity.mockResolvedValue(null);

    await expect(
      authenticateDocumentCollaborationConnection({
        documentName: `document:${context.documentId}`,
        requestHeaders: new Headers(),
      }),
    ).rejects.toThrow('permission-denied');
    expect(state.getAccess).not.toHaveBeenCalled();
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
      projectId: context.projectId,
    });

    await expect(
      authenticateDocumentCollaborationConnection({
        documentName: `document:${context.documentId}`,
        requestHeaders: new Headers(),
      }),
    ).resolves.toStrictEqual(context);
  });

  it('invalidates revoked sessions before permission lookup', async () => {
    state.isSessionActive.mockResolvedValue(false);

    await expect(revalidateDocumentCollaborationConnection(context)).resolves.toBeFalsy();
    expect(state.getAccess).not.toHaveBeenCalled();
  });

  it('replaces forged presence identity', () => {
    const states = new Map([
      [1, { cursor: { anchor: 1 }, user: { id: 'forged', name: 'Forged' } }],
    ]);

    sanitizeDocumentCollaborationAwareness({ context, states });

    expect(states.get(1)).toStrictEqual({
      cursor: { anchor: 1 },
      user: { id: context.userId, image: null, name: context.name },
    });
  });
});
