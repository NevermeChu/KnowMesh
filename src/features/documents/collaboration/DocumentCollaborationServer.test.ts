import { once } from 'node:events';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getDocumentCollaborationRoom } from './DocumentCollaborationRoom';
import {
  createDocumentCollaborationHealthServer,
  createDocumentCollaborationServer,
  stopDocumentCollaborationServer,
} from './DocumentCollaborationServer';

const state = vi.hoisted(() => ({
  persistedState: new Uint8Array() as Uint8Array,
}));

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./DocumentCollaborationSecurity'), () => ({
  assertDocumentCollaborationOrigin: vi.fn<() => void>(),
  // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous authentication API.
  authenticateDocumentCollaborationConnection: async () => ({
    canWrite: true,
    documentId: '30000000-0000-4000-8000-000000000003',
    image: null,
    name: 'User',
    projectId: '20000000-0000-4000-8000-000000000003',
    sessionId: 'session',
    userId: 'user',
  }),
  // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous authorization API.
  revalidateDocumentCollaborationConnection: async () => true,
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
  persistDocumentCollaborationState: async (options: { document: Y.Doc }) => {
    state.persistedState = Y.encodeStateAsUpdate(options.document);
  },
}));

describe('document collaboration server', () => {
  beforeEach(() => {
    state.persistedState = new Uint8Array();
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
      },
      { timeout: 3000 },
    );

    provider.destroy();
    websocketProvider.destroy();
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
});
