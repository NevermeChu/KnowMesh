import { once } from 'node:events';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import type { onStatelessParameters } from '@hocuspocus/provider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { DocumentCollaborationMetrics } from './DocumentCollaborationMetrics';
import { getDocumentCollaborationRoom } from './DocumentCollaborationRoom';
import {
  createDocumentCollaborationHealthServer,
  createDocumentCollaborationServer,
  revalidateDocumentCollaborationConnections,
  stopDocumentCollaborationServer,
} from './DocumentCollaborationServer';

const state = vi.hoisted(() => ({
  authCanWrite: true,
  persistError: null as Error | null,
  persistErrorDocumentIds: new Set<string>(),
  persistAttempts: [] as string[],
  persistedState: new Uint8Array() as Uint8Array,
  revalidate: vi.fn<() => Promise<boolean>>(),
}));

const createCollaborationContext = (userId: string) => ({
  canWrite: true,
  documentId: '30000000-0000-4000-8000-000000000009',
  image: null,
  name: 'User',
  projectId: '20000000-0000-4000-8000-000000000009',
  sessionId: `session-${userId}`,
  userId,
});

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/libs/Env'), () => ({
  Env: {
    BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
    COLLABORATION_ADDRESS: '127.0.0.1',
    COLLABORATION_HEALTH_PORT: 1235,
    COLLABORATION_PORT: 1234,
    DATABASE_URL: 'postgresql://localhost/knowmesh-test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_COLLABORATION_URL: 'ws://localhost:1234',
  },
}));
vi.mock(import('./DocumentCollaborationSecurity'), () => ({
  assertDocumentCollaborationOrigin: vi.fn<() => void>(),
  // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous authentication API.
  authenticateDocumentCollaborationConnection: async () => ({
    canWrite: state.authCanWrite,
    documentId: '30000000-0000-4000-8000-000000000003',
    image: null,
    name: 'User',
    projectId: '20000000-0000-4000-8000-000000000003',
    sessionId: 'session',
    userId: 'user',
  }),
  revalidateDocumentCollaborationConnection: state.revalidate,
  sanitizeDocumentCollaborationAwareness: vi.fn<() => void>(),
}));
vi.mock(import('./DocumentCollaborationPersistence'), () => ({
  // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous persistence API.
  loadDocumentCollaborationState: async () => {
    const document = new Y.Doc();
    if (state.persistedState.byteLength > 0) {
      Y.applyUpdate(document, state.persistedState);
    }
    return document;
  },
  // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous persistence API.
  persistDocumentCollaborationState: async (options: { document: Y.Doc; documentId: string }) => {
    state.persistAttempts.push(options.documentId);
    if (state.persistError || state.persistErrorDocumentIds.has(options.documentId)) {
      throw state.persistError ?? new Error(`Persistence failed for ${options.documentId}`);
    }
    state.persistedState = Y.encodeStateAsUpdate(options.document);
  },
}));

describe('document collaboration server', () => {
  beforeEach(() => {
    state.authCanWrite = true;
    state.persistError = null;
    state.persistErrorDocumentIds.clear();
    state.persistAttempts.length = 0;
    state.persistedState = new Uint8Array();
    state.revalidate.mockReset().mockResolvedValue(true);
  });

  it('restores persisted state after a server restart', async () => {
    const room = getDocumentCollaborationRoom('30000000-0000-4000-8000-000000000001');
    const firstServer = createDocumentCollaborationServer().server;
    const firstConnection = await firstServer.hocuspocus.openDirectConnection(room);

    await firstConnection.transact((document) => {
      document.getText('test').insert(0, 'persisted');
    });
    await firstConnection.disconnect({ unloadImmediately: true });
    await stopDocumentCollaborationServer({ server: firstServer });

    const secondServer = createDocumentCollaborationServer().server;
    const secondConnection = await secondServer.hocuspocus.openDirectConnection(room);

    expect(secondConnection.document?.getText('test').toJSON()).toBe('persisted');

    await secondConnection.disconnect({ unloadImmediately: true });
    await stopDocumentCollaborationServer({ server: secondServer });
  });

  it('persists websocket document changes after debounce', async () => {
    const room = getDocumentCollaborationRoom('30000000-0000-4000-8000-000000000003');
    const { server } = createDocumentCollaborationServer();
    server.configuration.port = 0;
    await server.listen();
    const websocketProvider = new HocuspocusProviderWebsocket({
      WebSocketPolyfill: globalThis.WebSocket,
      url: `ws://127.0.0.1:${server.address.port}`,
    });
    const provider = new HocuspocusProvider({
      name: room,
      websocketProvider,
    });
    const persistenceMessages: string[] = [];
    provider.on('stateless', (data: onStatelessParameters) => {
      persistenceMessages.push(data.payload);
    });
    provider.attach();

    await vi.waitFor(() => {
      expect(provider.isSynced).toBeTruthy();
    });
    provider.document.getText('test').insert(0, 'persisted through websocket');
    await vi.waitFor(
      () => {
        expect(state.persistedState.byteLength).toBeGreaterThan(0);
        const persistedDocument = new Y.Doc();
        Y.applyUpdate(persistedDocument, state.persistedState);
        expect(persistedDocument.getText('test').toJSON()).toBe('persisted through websocket');
        expect(persistenceMessages).toContain(
          JSON.stringify({ status: 'saved', type: 'document-persistence' }),
        );
      },
      { timeout: 3000 },
    );

    provider.destroy();
    websocketProvider.destroy();
    await stopDocumentCollaborationServer({ server });
  });

  it('rejects viewer websocket updates', async () => {
    const room = getDocumentCollaborationRoom('30000000-0000-4000-8000-000000000008');
    state.authCanWrite = false;
    const { metrics, server } = createDocumentCollaborationServer();
    server.configuration.port = 0;
    await server.listen();
    const websocketProvider = new HocuspocusProviderWebsocket({
      WebSocketPolyfill: globalThis.WebSocket,
      url: `ws://127.0.0.1:${server.address.port}`,
    });
    const provider = new HocuspocusProvider({ name: room, websocketProvider });
    provider.attach();

    await vi.waitFor(() => {
      expect(provider.isSynced).toBeTruthy();
      expect(provider.authorizedScope).toBe('readonly');
    });
    provider.document.getText('test').insert(0, 'viewer update');

    await vi.waitFor(() => {
      expect(provider.unsyncedChanges).toBeGreaterThan(0);
    });
    expect(server.hocuspocus.documents.get(room)?.getText('test').toJSON()).toBe('');
    expect(
      metrics.snapshot({ activeConnections: 1, activeDocuments: 1 }).readOnlyWriteRejections,
    ).toBeGreaterThan(0);

    provider.destroy();
    websocketProvider.destroy();
    await stopDocumentCollaborationServer({ server });
  });

  it('reports websocket persistence failures to connected clients', async () => {
    const room = getDocumentCollaborationRoom('30000000-0000-4000-8000-000000000004');
    state.persistError = new Error('Database unavailable');
    const { server } = createDocumentCollaborationServer();
    server.configuration.port = 0;
    await server.listen();
    const websocketProvider = new HocuspocusProviderWebsocket({
      WebSocketPolyfill: globalThis.WebSocket,
      url: `ws://127.0.0.1:${server.address.port}`,
    });
    const provider = new HocuspocusProvider({
      name: room,
      websocketProvider,
    });
    const persistenceMessages: string[] = [];
    provider.on('stateless', (data: onStatelessParameters) => {
      persistenceMessages.push(data.payload);
    });
    provider.attach();

    await vi.waitFor(() => {
      expect(provider.isSynced).toBeTruthy();
    });
    provider.document.getText('test').insert(0, 'not persisted');
    await vi.waitFor(
      () => {
        expect(persistenceMessages).toContain(
          JSON.stringify({ status: 'error', type: 'document-persistence' }),
        );
      },
      { timeout: 3000 },
    );

    provider.destroy();
    websocketProvider.destroy();
    state.persistError = null;
    await vi.waitFor(
      () => {
        const persistedDocument = new Y.Doc();
        Y.applyUpdate(persistedDocument, state.persistedState);
        expect(persistedDocument.getText('test').toJSON()).toBe('not persisted');
      },
      { timeout: 3000 },
    );
    await stopDocumentCollaborationServer({ server });
  });

  it('reports not ready when the database check fails', async () => {
    const { metrics, server } = createDocumentCollaborationServer();
    const healthServer = createDocumentCollaborationHealthServer({
      checkReadiness: async () => {
        await Promise.reject(new Error('Database unavailable'));
      },
      collaborationServer: server,
      metrics,
    });
    healthServer.listen(0, '127.0.0.1');
    await once(healthServer, 'listening');
    const address = healthServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Health server address unavailable');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/ready`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: 'not_ready' });

    const closed = once(healthServer, 'close');
    healthServer.close();
    await closed;
    await stopDocumentCollaborationServer({ server });
  });

  it('destroys servers when final persistence fails', async () => {
    const room = getDocumentCollaborationRoom('30000000-0000-4000-8000-000000000005');
    const { metrics, server } = createDocumentCollaborationServer();
    const connection = await server.hocuspocus.openDirectConnection(room);
    const healthServer = createDocumentCollaborationHealthServer({
      collaborationServer: server,
      metrics,
    });
    healthServer.listen(0, '127.0.0.1');
    await once(healthServer, 'listening');
    const destroy = vi.spyOn(server, 'destroy').mockResolvedValue();
    state.persistError = new Error('Database unavailable during shutdown');

    await expect(stopDocumentCollaborationServer({ healthServer, server })).rejects.toThrow(
      'Database unavailable during shutdown',
    );

    expect(destroy).toHaveBeenCalledOnce();
    expect(healthServer.listening).toBeFalsy();
    state.persistError = null;
    await connection.disconnect({ unloadImmediately: true });
  });

  it('persists remaining documents when one final store fails', async () => {
    const firstDocumentId = '30000000-0000-4000-8000-000000000006';
    const secondDocumentId = '30000000-0000-4000-8000-000000000007';
    const { server } = createDocumentCollaborationServer();
    const firstConnection = await server.hocuspocus.openDirectConnection(
      getDocumentCollaborationRoom(firstDocumentId),
    );
    const secondConnection = await server.hocuspocus.openDirectConnection(
      getDocumentCollaborationRoom(secondDocumentId),
    );
    const destroy = vi.spyOn(server, 'destroy').mockResolvedValue();
    state.persistAttempts.length = 0;
    state.persistErrorDocumentIds.add(firstDocumentId);

    await expect(stopDocumentCollaborationServer({ server })).rejects.toThrow(
      `Persistence failed for ${firstDocumentId}`,
    );

    expect(state.persistAttempts).toContain(firstDocumentId);
    expect(state.persistAttempts).toContain(secondDocumentId);
    expect(destroy).toHaveBeenCalledOnce();
    state.persistErrorDocumentIds.clear();
    await firstConnection.disconnect({ unloadImmediately: true });
    await secondConnection.disconnect({ unloadImmediately: true });
  });

  it('continues revalidation after one connection query fails', async () => {
    const firstClose = vi.fn<() => void>();
    const secondClose = vi.fn<() => void>();
    const metrics = new DocumentCollaborationMetrics();
    const consoleError = vi.spyOn(console, 'error').mockReturnValue();
    state.revalidate
      .mockRejectedValueOnce(new Error('Database query failed'))
      .mockResolvedValueOnce(false);

    await revalidateDocumentCollaborationConnections({
      connections: [
        { close: firstClose, context: createCollaborationContext('first') },
        { close: secondClose, context: createCollaborationContext('second') },
      ],
      metrics,
    });

    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledOnce();
    expect(
      metrics.snapshot({ activeConnections: 2, activeDocuments: 1 }).invalidatedConnections,
    ).toBe(1);
    consoleError.mockRestore();
  });
});
