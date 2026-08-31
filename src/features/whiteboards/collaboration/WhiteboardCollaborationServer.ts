import { once } from 'node:events';
import { createServer } from 'node:http';
import { sql } from 'drizzle-orm';
import { Server } from 'socket.io';
import { DocumentCollaborationInvalidationSubscriber } from '@/features/documents/collaboration/DocumentCollaborationInvalidation';
import { db } from '@/libs/DB';
import { WhiteboardCollaborationMetrics } from './WhiteboardCollaborationMetrics';
import {
  loadTeamWhiteboardCanonicalScene,
  saveTeamWhiteboardCandidate,
} from './WhiteboardCollaborationPersistence';
import {
  MAX_WHITEBOARD_CURSOR_EVENTS_PER_WINDOW,
  MAX_WHITEBOARD_LIVE_SCENE_EVENTS_PER_WINDOW,
  MAX_WHITEBOARD_SAVE_EVENTS_PER_WINDOW,
  WHITEBOARD_COLLABORATION_PATH,
  WHITEBOARD_SAVE_RATE_WINDOW_MS,
  whiteboardCandidateSchema,
  whiteboardLiveSceneUpdateSchema,
  whiteboardPointerSchema,
} from './WhiteboardCollaborationProtocol';
import type {
  WhiteboardClientToServerEvents,
  WhiteboardCollaborationMember,
  WhiteboardServerToClientEvents,
  WhiteboardSocketData,
} from './WhiteboardCollaborationProtocol';
import {
  authenticateWhiteboardCollaborationConnection,
  revalidateWhiteboardCollaborationConnection,
} from './WhiteboardCollaborationSecurity';

const AUTHORIZATION_REVALIDATION_MS = 15_000;
const MAX_CONNECTIONS = 1000;
const MAX_CONNECTIONS_PER_DOCUMENT = 100;
const MAX_CONNECTIONS_PER_USER = 10;
const MAX_HTTP_BUFFER_BYTES = 6 * 1024 * 1024;
const WRITE_REVALIDATION_INTERVAL_MS = 3000;

function toRequestHeaders(headers: Record<string, string | string[] | undefined>) {
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        requestHeaders.append(name, item);
      }
    } else if (value !== undefined) {
      requestHeaders.set(name, value);
    }
  }
  return requestHeaders;
}

export function createWhiteboardCollaborationServer(options: { allowedOrigin: string }) {
  const metrics = new WhiteboardCollaborationMetrics();
  const membersByDocument = new Map<string, Map<string, WhiteboardCollaborationMember>>();
  const websocketServer = createServer();
  const io = new Server<
    WhiteboardClientToServerEvents,
    WhiteboardServerToClientEvents,
    Record<string, never>,
    WhiteboardSocketData
  >(websocketServer, {
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Engine.IO defines this callback API.
    allowRequest: (request, callback) => {
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Engine.IO defines this callback API.
      callback(null, request.headers.origin === options.allowedOrigin);
    },
    cors: { credentials: true, origin: options.allowedOrigin },
    maxHttpBufferSize: MAX_HTTP_BUFFER_BYTES,
    path: WHITEBOARD_COLLABORATION_PATH,
    perMessageDeflate: false,
    transports: ['websocket'],
  });
  const healthServer = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!['/health', '/live', '/metrics', '/ready'].includes(path)) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    const snapshot = metrics.snapshot({
      activeConnections: io.engine.clientsCount,
      activeRooms: membersByDocument.size,
    });
    if (path === '/live') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (path === '/metrics') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(snapshot));
      return;
    }
    try {
      await db.execute(sql`SELECT 1`);
      if (!metrics.isReady()) {
        throw new Error('persistence-degraded');
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ready', ...snapshot }));
    } catch {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'not_ready', ...snapshot }));
    }
  });

  const emitPresence = (documentId: string) => {
    io.to(documentId).emit('presence', [...(membersByDocument.get(documentId)?.values() ?? [])]);
  };
  const freezeSocket = (socketId: string, reason: 'permission-denied' | 'service-unavailable') => {
    const socket = io.sockets.sockets.get(socketId);
    socket?.emit('frozen', reason);
    socket?.disconnect(true);
  };

  io.use(async (socket, next) => {
    try {
      if (io.engine.clientsCount > MAX_CONNECTIONS) {
        throw new Error('connection-limit-exceeded');
      }
      const context = await authenticateWhiteboardCollaborationConnection({
        auth: socket.handshake.auth,
        requestHeaders: toRequestHeaders(socket.request.headers),
      });
      const sockets = [...io.sockets.sockets.values()];
      if (
        sockets.filter((item) => item.data.documentId === context.documentId).length >=
          MAX_CONNECTIONS_PER_DOCUMENT ||
        sockets.filter((item) => item.data.userId === context.userId).length >=
          MAX_CONNECTIONS_PER_USER
      ) {
        throw new Error('connection-limit-exceeded');
      }
      socket.data = context;
      next();
    } catch {
      metrics.recordAuthenticationFailure();
      next(new Error('permission-denied'));
    }
  });

  io.on('connection', async (socket) => {
    const context = socket.data;
    const documentMembers =
      membersByDocument.get(context.documentId) ?? new Map<string, WhiteboardCollaborationMember>();
    membersByDocument.set(context.documentId, documentMembers);
    documentMembers.set(socket.id, {
      connectionId: socket.id,
      id: context.userId,
      image: context.image,
      name: context.name,
    });
    await socket.join(context.documentId);
    try {
      const canonical = await loadTeamWhiteboardCanonicalScene(context.documentId);
      metrics.recordLoadSuccess(context.documentId);
      socket.emit('baseline', {
        ...canonical,
        canWrite: context.canWrite,
        members: [...documentMembers.values()],
      });
      emitPresence(context.documentId);
    } catch {
      metrics.recordPersistenceFailure(context.documentId);
      freezeSocket(socket.id, 'service-unavailable');
      return;
    }

    let cursorEventTimestamps: number[] = [];
    let liveSceneEventTimestamps: number[] = [];
    let saveEventTimestamps: number[] = [];

    socket.on('scene', async (updateValue) => {
      const update = whiteboardLiveSceneUpdateSchema.safeParse(updateValue);
      if (!update.success) {
        socket.disconnect(true);
        return;
      }
      const now = Date.now();
      liveSceneEventTimestamps = liveSceneEventTimestamps.filter(
        (timestamp) => now - timestamp < WHITEBOARD_SAVE_RATE_WINDOW_MS,
      );
      if (liveSceneEventTimestamps.length >= MAX_WHITEBOARD_LIVE_SCENE_EVENTS_PER_WINDOW) {
        metrics.recordDroppedLiveSceneUpdate();
        return;
      }
      liveSceneEventTimestamps.push(now);
      if (!context.canWrite) {
        metrics.recordReadOnlyWriteRejection();
        return;
      }
      try {
        if (now - context.accessValidatedAt >= WRITE_REVALIDATION_INTERVAL_MS) {
          if (!(await revalidateWhiteboardCollaborationConnection(context))) {
            metrics.recordInvalidatedConnection();
            freezeSocket(socket.id, 'permission-denied');
            return;
          }
          context.accessValidatedAt = now;
        }
        socket.to(context.documentId).emit('scene', {
          ...update.data,
          connectionId: socket.id,
        });
        metrics.recordLiveSceneUpdate();
      } catch {
        freezeSocket(socket.id, 'service-unavailable');
      }
    });

    socket.on('save', async (candidateValue, acknowledge) => {
      const parsed = whiteboardCandidateSchema.safeParse(candidateValue);
      if (!parsed.success) {
        socket.disconnect(true);
        return;
      }
      const now = Date.now();
      saveEventTimestamps = saveEventTimestamps.filter(
        (timestamp) => now - timestamp < WHITEBOARD_SAVE_RATE_WINDOW_MS,
      );
      if (saveEventTimestamps.length >= MAX_WHITEBOARD_SAVE_EVENTS_PER_WINDOW) {
        metrics.recordRateLimitedSave();
        acknowledge({
          clientMutationId: parsed.data.clientMutationId,
          message: 'rate-limited',
          retryAfterMs: Math.max(
            1,
            (saveEventTimestamps[0] ?? now) + WHITEBOARD_SAVE_RATE_WINDOW_MS - now,
          ),
          status: 'error',
        });
        return;
      }
      saveEventTimestamps.push(now);

      if (!context.canWrite) {
        metrics.recordReadOnlyWriteRejection();
        acknowledge({
          clientMutationId: parsed.data.clientMutationId,
          message: 'permission-denied',
          status: 'error',
        });
        return;
      }
      try {
        if (now - context.accessValidatedAt >= WRITE_REVALIDATION_INTERVAL_MS) {
          if (!(await revalidateWhiteboardCollaborationConnection(context))) {
            metrics.recordInvalidatedConnection();
            acknowledge({
              clientMutationId: parsed.data.clientMutationId,
              message: 'permission-denied',
              status: 'error',
            });
            freezeSocket(socket.id, 'permission-denied');
            return;
          }
          context.accessValidatedAt = now;
        }
        const result = await saveTeamWhiteboardCandidate({
          documentId: context.documentId,
          expectedRevision: parsed.data.expectedRevision,
          scene: parsed.data.scene,
        });
        if (result.status === 'conflict') {
          metrics.recordConflict();
          acknowledge({ ...result, clientMutationId: parsed.data.clientMutationId });
          return;
        }
        metrics.recordSave(context.documentId);
        const canonical = {
          revision: result.revision,
          scene: result.scene,
          updatedAt: result.updatedAt,
        };
        acknowledge({
          ...canonical,
          clientMutationId: parsed.data.clientMutationId,
          status: 'saved',
        });
        socket.to(context.documentId).emit('canonical', canonical);
      } catch (error) {
        metrics.recordPersistenceFailure(context.documentId);
        acknowledge({
          clientMutationId: parsed.data.clientMutationId,
          message:
            error instanceof Error && error.message === 'permission-denied'
              ? 'permission-denied'
              : 'persistence-failed',
          status: 'error',
        });
      }
    });

    socket.on('cursor', (pointerValue) => {
      const pointer = whiteboardPointerSchema.safeParse(pointerValue);
      if (!pointer.success) {
        return;
      }
      const now = Date.now();
      cursorEventTimestamps = cursorEventTimestamps.filter(
        (timestamp) => now - timestamp < WHITEBOARD_SAVE_RATE_WINDOW_MS,
      );
      if (cursorEventTimestamps.length >= MAX_WHITEBOARD_CURSOR_EVENTS_PER_WINDOW) {
        metrics.recordDroppedCursorUpdate();
        return;
      }
      cursorEventTimestamps.push(now);
      socket.to(context.documentId).volatile.emit('cursor', {
        ...pointer.data,
        connectionId: socket.id,
      });
      metrics.recordCursorUpdate();
    });

    socket.on('disconnect', () => {
      documentMembers.delete(socket.id);
      if (documentMembers.size === 0) {
        membersByDocument.delete(context.documentId);
      } else {
        emitPresence(context.documentId);
      }
    });
  });

  const revalidateConnections = async (predicate?: (context: WhiteboardSocketData) => boolean) => {
    for (const socket of io.sockets.sockets.values()) {
      if (predicate && !predicate(socket.data)) {
        continue;
      }
      try {
        if (!(await revalidateWhiteboardCollaborationConnection(socket.data))) {
          metrics.recordInvalidatedConnection();
          freezeSocket(socket.id, 'permission-denied');
        }
      } catch {
        freezeSocket(socket.id, 'service-unavailable');
      }
    }
  };
  const revalidationTimer = setInterval(() => {
    void revalidateConnections();
  }, AUTHORIZATION_REVALIDATION_MS);
  revalidationTimer.unref();
  const invalidationSubscriber = new DocumentCollaborationInvalidationSubscriber(
    async (invalidation) => {
      if (invalidation.kind === 'document_title') {
        return;
      }
      await revalidateConnections((context) => {
        if (invalidation.kind === 'document') {
          return context.documentId === invalidation.documentId;
        }
        if (invalidation.kind === 'project_member') {
          return (
            context.projectId === invalidation.projectId && context.userId === invalidation.userId
          );
        }
        return context.sessionId === invalidation.sessionId;
      });
    },
  );

  return {
    healthServer,
    invalidationSubscriber,
    io,
    metrics,
    stop: async () => {
      clearInterval(revalidationTimer);
      invalidationSubscriber.stop();
      io.emit('frozen', 'service-unavailable');
      io.disconnectSockets(true);
      await io.close();
      if (healthServer.listening) {
        const closed = once(healthServer, 'close');
        healthServer.close();
        await closed;
      }
    },
    websocketServer,
  };
}
