import { once } from 'node:events';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_WHITEBOARD_SAVE_EVENTS_PER_WINDOW,
  WHITEBOARD_COLLABORATION_PATH,
  whiteboardSaveAcknowledgementSchema,
} from './WhiteboardCollaborationProtocol';
import type {
  WhiteboardCanonicalScene,
  WhiteboardSocketData,
} from './WhiteboardCollaborationProtocol';
import { createWhiteboardCollaborationServer } from './WhiteboardCollaborationServer';

const allowedOrigin = 'http://localhost:3000';
const state = vi.hoisted(() => ({
  authCanWrite: true,
  documentId: '30000000-0000-4000-8000-000000000062',
  persistError: null as Error | null,
  revision: 1,
  scene: {
    appState: {},
    elements: [] as Record<string, never>[],
    files: {} as Record<string, never>,
    source: 'knowmesh' as const,
    type: 'excalidraw' as const,
    version: 1 as const,
  },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The Drizzle pool type is unrelated to the health-check execute stub.
vi.mock('@/libs/DB', () => ({
  db: {
    execute: vi.fn<() => Promise<unknown[]>>(async () => {
      await Promise.resolve();
      return [];
    }),
  },
}));

vi.mock(import('./WhiteboardCollaborationSecurity'), () => ({
  authenticateWhiteboardCollaborationConnection: vi.fn<() => Promise<WhiteboardSocketData>>(
    async () => {
      await Promise.resolve();
      return {
        accessValidatedAt: Date.now(),
        canWrite: state.authCanWrite,
        documentId: state.documentId,
        image: null,
        name: 'Editor',
        projectId: '20000000-0000-4000-8000-000000000062',
        sessionId: 'session',
        userId: 'user',
      };
    },
  ),
  revalidateWhiteboardCollaborationConnection: vi.fn<() => Promise<boolean>>(async () => {
    await Promise.resolve();
    return true;
  }),
}));

vi.mock(import('./WhiteboardCollaborationPersistence'), () => ({
  loadTeamWhiteboardCanonicalScene: vi.fn<() => Promise<WhiteboardCanonicalScene>>(async () => {
    await Promise.resolve();
    return {
      revision: state.revision,
      scene: state.scene,
      updatedAt: new Date().toISOString(),
    };
  }),
  saveTeamWhiteboardCandidate: vi.fn<
    (options: {
      expectedRevision: number;
    }) => Promise<WhiteboardCanonicalScene & { status: 'conflict' | 'saved' }>
  >(async (options) => {
    await Promise.resolve();
    if (state.persistError) {
      throw state.persistError;
    }
    if (options.expectedRevision !== state.revision) {
      return {
        revision: state.revision,
        scene: state.scene,
        status: 'conflict',
        updatedAt: new Date().toISOString(),
      };
    }
    state.revision += 1;
    return {
      revision: state.revision,
      scene: state.scene,
      status: 'saved',
      updatedAt: new Date().toISOString(),
    };
  }),
}));

const waitForEvent = async <T>(socket: Socket, event: string) =>
  // oxlint-disable-next-line promise/avoid-new -- Socket.IO exposes event listeners, not promises.
  await new Promise<T>((resolve) => {
    socket.once(event, (payload: T) => {
      resolve(payload);
    });
  });

const connectClient = async (port: number) => {
  const socket = io(`http://127.0.0.1:${port}`, {
    auth: { documentId: state.documentId },
    autoConnect: false,
    extraHeaders: { origin: allowedOrigin },
    forceNew: true,
    path: WHITEBOARD_COLLABORATION_PATH,
    transports: ['websocket'],
  });
  const connected = waitForEvent<undefined>(socket, 'connect');
  const baselineReceived = waitForEvent<unknown>(socket, 'baseline');
  socket.connect();
  await connected;
  return { baseline: await baselineReceived, socket };
};

describe('whiteboard collaboration server', () => {
  let service: ReturnType<typeof createWhiteboardCollaborationServer> | undefined;

  beforeEach(() => {
    state.authCanWrite = true;
    state.persistError = null;
    state.revision = 1;
  });

  afterEach(async () => {
    await service?.stop();
    service = undefined;
  });

  const startService = async () => {
    service = createWhiteboardCollaborationServer({ allowedOrigin });
    service.websocketServer.listen(0, '127.0.0.1');
    await once(service.websocketServer, 'listening');
    const address = service.websocketServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Whiteboard collaboration port is unavailable');
    }
    return address.port;
  };

  it('sends a persisted baseline and rejects viewer writes', async () => {
    state.authCanWrite = false;
    const port = await startService();
    const { baseline, socket } = await connectClient(port);

    expect(baseline).toMatchObject({ canWrite: false, revision: 1 });

    const acknowledgement = await socket.timeout(2000).emitWithAck('save', {
      clientMutationId: crypto.randomUUID(),
      expectedRevision: 1,
      scene: state.scene,
    });
    expect(acknowledgement).toMatchObject({ message: 'permission-denied', status: 'error' });
    expect(
      service?.metrics.snapshot({ activeConnections: 1, activeRooms: 1 }).readOnlyWriteRejections,
    ).toBe(1);

    socket.disconnect();
  });

  it('broadcasts a canonical scene only after a successful save', async () => {
    const port = await startService();
    const { socket: writer } = await connectClient(port);
    const { socket: reader } = await connectClient(port);
    const canonical = waitForEvent<{ revision: number }>(reader, 'canonical');

    const acknowledgement = await writer.timeout(2000).emitWithAck('save', {
      clientMutationId: crypto.randomUUID(),
      expectedRevision: 1,
      scene: state.scene,
    });

    expect(acknowledgement).toMatchObject({ revision: 2, status: 'saved' });
    await expect(canonical).resolves.toMatchObject({ revision: 2 });

    writer.disconnect();
    reader.disconnect();
  });

  it('returns a persistence error without broadcasting', async () => {
    state.persistError = new Error('Database unavailable');
    const port = await startService();
    const { socket: writer } = await connectClient(port);
    const { socket: reader } = await connectClient(port);
    let receivedCanonical = false;
    reader.on('canonical', () => {
      receivedCanonical = true;
    });

    const acknowledgement = await writer.timeout(2000).emitWithAck('save', {
      clientMutationId: crypto.randomUUID(),
      expectedRevision: 1,
      scene: state.scene,
    });

    expect(acknowledgement).toMatchObject({ message: 'persistence-failed', status: 'error' });
    expect(receivedCanonical).toBeFalsy();
    expect(service?.metrics.isReady()).toBeFalsy();

    writer.disconnect();
    reader.disconnect();
  });

  it('returns rate-limit backpressure without disconnecting the writer', async () => {
    const port = await startService();
    const { socket } = await connectClient(port);
    let expectedRevision = 1;

    for (let index = 0; index < MAX_WHITEBOARD_SAVE_EVENTS_PER_WINDOW; index += 1) {
      const acknowledgement = whiteboardSaveAcknowledgementSchema.parse(
        await socket.timeout(2000).emitWithAck('save', {
          clientMutationId: crypto.randomUUID(),
          expectedRevision,
          scene: state.scene,
        }),
      );
      if (acknowledgement.status !== 'saved') {
        throw new Error('Expected a saved acknowledgement before the rate limit');
      }
      expectedRevision = acknowledgement.revision;
    }

    const rateLimited = whiteboardSaveAcknowledgementSchema.parse(
      await socket.timeout(2000).emitWithAck('save', {
        clientMutationId: crypto.randomUUID(),
        expectedRevision,
        scene: state.scene,
      }),
    );

    expect(rateLimited).toMatchObject({
      message: 'rate-limited',
      status: 'error',
    });
    expect(rateLimited).toHaveProperty('retryAfterMs', expect.any(Number));
    expect(socket.connected).toBeTruthy();
    expect(
      service?.metrics.snapshot({ activeConnections: 1, activeRooms: 1 }).rateLimitedSaves,
    ).toBe(1);

    socket.disconnect();
  });
});
