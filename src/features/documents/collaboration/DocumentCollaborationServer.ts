import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Server } from '@hocuspocus/server';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { documentCollaborationStatesSchema } from '@/models/Schema';
import { DocumentCollaborationInvalidationSubscriber } from './DocumentCollaborationInvalidation';
import type { DocumentCollaborationInvalidation } from './DocumentCollaborationInvalidation';
import { DocumentCollaborationMetrics } from './DocumentCollaborationMetrics';
import {
  loadDocumentCollaborationState,
  persistDocumentCollaborationState,
} from './DocumentCollaborationPersistence';
import { getDocumentIdFromCollaborationRoom } from './DocumentCollaborationRoom';
import {
  assertDocumentCollaborationOrigin,
  authenticateDocumentCollaborationConnection,
  revalidateDocumentCollaborationConnection,
  sanitizeDocumentCollaborationAwareness,
} from './DocumentCollaborationSecurity';
import type { DocumentCollaborationContext } from './DocumentCollaborationSecurity';

const STORE_DEBOUNCE_MS = 1000;
const STORE_MAX_DEBOUNCE_MS = 5000;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const READINESS_TIMEOUT_MS = 2000;
const SHUTDOWN_TIMEOUT_MS = 15_000;
const AUTHORIZATION_REVALIDATION_MS = 15_000;
const MAX_CONNECTIONS = 1000;
const MAX_CONNECTIONS_PER_DOCUMENT = 100;
const MAX_CONNECTIONS_PER_USER = 10;
const SYNC_STEP_TWO = 1;
const SYNC_UPDATE = 2;
const securityCleanups = new WeakMap<Server<DocumentCollaborationContext>, () => void>();

function getDocumentCollaborationConnections(server: Server<DocumentCollaborationContext>) {
  return [...server.hocuspocus.documents.values()].flatMap((document) => document.getConnections());
}

function isDocumentCollaborationContext(value: unknown): value is DocumentCollaborationContext {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (
    'canWrite' in value &&
    'documentId' in value &&
    'projectId' in value &&
    'sessionId' in value &&
    'userId' in value
  );
}

function matchesInvalidation(
  context: DocumentCollaborationContext,
  invalidation: DocumentCollaborationInvalidation,
) {
  if (invalidation.kind === 'document') {
    return context.documentId === invalidation.documentId;
  }
  if (invalidation.kind === 'project_member') {
    return context.projectId === invalidation.projectId && context.userId === invalidation.userId;
  }
  return context.sessionId === invalidation.sessionId;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string) {
  const controller = new AbortController();
  try {
    return await Promise.race([
      operation,
      delay(timeoutMs, undefined, { signal: controller.signal }).then(() => {
        throw new Error(message);
      }),
    ]);
  } finally {
    controller.abort();
  }
}

export function createDocumentCollaborationServer() {
  const metrics = new DocumentCollaborationMetrics();
  const allowedOrigin = new URL(Env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin;

  const server = new Server<DocumentCollaborationContext>({
    address: Env.COLLABORATION_ADDRESS,
    debounce: STORE_DEBOUNCE_MS,
    maxPendingDocuments: 1,
    maxUnauthenticatedQueueMessages: 32,
    maxUnauthenticatedQueueSize: 64 * 1024,
    maxDebounce: STORE_MAX_DEBOUNCE_MS,
    port: Env.COLLABORATION_PORT,
    quiet: true,
    stopOnSignals: false,
    timeout: 30_000,
    unloadImmediately: false,
    websocketOptions: { maxPayload: MAX_PAYLOAD_BYTES },
    // oxlint-disable-next-line eslint/require-await -- Hocuspocus hooks require a Promise result.
    async beforeHandleAwareness(data) {
      if (data.connection) {
        sanitizeDocumentCollaborationAwareness({
          context: data.connection.context,
          states: data.states,
        });
      }
    },
    async beforeSync(data) {
      if (data.type !== SYNC_STEP_TWO && data.type !== SYNC_UPDATE) {
        return;
      }

      if (data.connection.readOnly) {
        metrics.recordReadOnlyWriteRejection();
        return;
      }

      if (!(await revalidateDocumentCollaborationConnection(data.context))) {
        metrics.recordInvalidatedConnection();
        data.connection.close();
        throw new Error('permission-denied');
      }
    },
    async onAuthenticate(data) {
      try {
        const context = await authenticateDocumentCollaborationConnection({
          documentName: data.documentName,
          requestHeaders: data.requestHeaders,
        });
        const connections = getDocumentCollaborationConnections(server);
        const documentConnections =
          server.hocuspocus.documents.get(data.documentName)?.getConnectionsCount() ?? 0;
        const userConnections = connections.filter(
          (connection) =>
            isDocumentCollaborationContext(connection.context) &&
            connection.context.userId === context.userId,
        ).length;

        if (
          documentConnections >= MAX_CONNECTIONS_PER_DOCUMENT ||
          userConnections >= MAX_CONNECTIONS_PER_USER
        ) {
          throw new Error('connection-limit-exceeded');
        }

        data.connectionConfig.readOnly = !context.canWrite;
        return context;
      } catch (error) {
        metrics.recordAuthenticationFailure();
        console.warn(
          JSON.stringify({
            error:
              error instanceof Error && error.message === 'connection-limit-exceeded'
                ? error.message
                : 'permission-denied',
            event: 'document_collaboration_authentication_failed',
          }),
        );
        throw error;
      }
    },
    // oxlint-disable-next-line eslint/require-await -- Hocuspocus hooks require a Promise result.
    async onConnect(data) {
      try {
        assertDocumentCollaborationOrigin({
          allowedOrigin,
          requestHeaders: data.requestHeaders,
        });
        if (server.hocuspocus.getConnectionsCount() >= MAX_CONNECTIONS) {
          throw new Error('connection-limit-exceeded');
        }
      } catch (error) {
        metrics.recordAuthenticationFailure();
        throw error;
      }
    },
    async onLoadDocument(data) {
      const documentId = getDocumentIdFromCollaborationRoom(data.documentName);
      return await loadDocumentCollaborationState(documentId);
    },
    // oxlint-disable-next-line eslint/require-await -- Hocuspocus hooks require a Promise result.
    async onChange() {
      metrics.recordDocumentChange();
    },
    async onStoreDocument(data) {
      const documentId = getDocumentIdFromCollaborationRoom(data.documentName);

      try {
        await persistDocumentCollaborationState({ document: data.document, documentId });
        metrics.recordStoreSuccess();
      } catch (error) {
        metrics.recordStoreFailure();
        if (error instanceof Error && error.message === '协作文档正文投影失败') {
          metrics.recordProjectionFailure();
        }
        console.error(
          JSON.stringify({
            documentId,
            error: error instanceof Error ? error.message : 'Unknown collaboration store error',
            event: 'document_collaboration_store_failed',
          }),
        );
        throw error;
      }
    },
  });

  const invalidationSubscriber = new DocumentCollaborationInvalidationSubscriber(
    async (invalidation) => {
      for (const connection of getDocumentCollaborationConnections(server)) {
        if (
          isDocumentCollaborationContext(connection.context) &&
          matchesInvalidation(connection.context, invalidation) &&
          !(await revalidateDocumentCollaborationConnection(connection.context))
        ) {
          metrics.recordInvalidatedConnection();
          connection.close();
        }
      }
    },
  );

  let revalidationRunning = false;
  const revalidationTimer = setInterval(() => {
    if (revalidationRunning) {
      return;
    }
    revalidationRunning = true;
    void (async () => {
      try {
        for (const connection of getDocumentCollaborationConnections(server)) {
          if (
            isDocumentCollaborationContext(connection.context) &&
            !(await revalidateDocumentCollaborationConnection(connection.context))
          ) {
            metrics.recordInvalidatedConnection();
            connection.close();
          }
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown revalidation error',
            event: 'document_collaboration_revalidation_failed',
          }),
        );
      } finally {
        revalidationRunning = false;
      }
    })();
  }, AUTHORIZATION_REVALIDATION_MS);
  revalidationTimer.unref();
  securityCleanups.set(server, () => {
    clearInterval(revalidationTimer);
    invalidationSubscriber.stop();
  });

  return { invalidationSubscriber, metrics, server };
}

export function createDocumentCollaborationHealthServer(options: {
  checkReadiness?: () => Promise<void>;
  collaborationServer: Server<DocumentCollaborationContext>;
  metrics: DocumentCollaborationMetrics;
}) {
  const checkReadiness =
    options.checkReadiness ??
    (async () => {
      await db
        .select({ documentId: documentCollaborationStatesSchema.documentId })
        .from(documentCollaborationStatesSchema)
        .limit(0);
    });

  return createHttpServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!['/health', '/live', '/metrics', '/ready'].includes(path)) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }

    const snapshot = options.metrics.snapshot({
      activeConnections: options.collaborationServer.hocuspocus.getConnectionsCount(),
      activeDocuments: options.collaborationServer.hocuspocus.getDocumentsCount(),
    });

    if (path === '/live') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (path === '/health' || path === '/ready') {
      try {
        await withTimeout(checkReadiness(), READINESS_TIMEOUT_MS, 'Database readiness timed out');
        if (!options.metrics.isStoreReady()) {
          throw new Error('Collaboration persistence is degraded');
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'ready', ...snapshot }));
      } catch {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'not_ready', ...snapshot }));
      }
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(snapshot));
  });
}

export async function stopDocumentCollaborationServer(options: {
  healthServer?: ReturnType<typeof createHttpServer>;
  server: Server<DocumentCollaborationContext>;
}) {
  securityCleanups.get(options.server)?.();
  securityCleanups.delete(options.server);
  options.server.httpServer.close();
  options.server.hocuspocus.closeConnections();

  for (const [documentName, document] of options.server.hocuspocus.documents) {
    const documentId = getDocumentIdFromCollaborationRoom(documentName);
    await document.saveMutex.runExclusive(async () => {
      await persistDocumentCollaborationState({ document, documentId });
    });
  }

  await withTimeout(
    options.server.destroy(),
    SHUTDOWN_TIMEOUT_MS,
    `协作服务未能在 ${SHUTDOWN_TIMEOUT_MS}ms 内关闭`,
  );

  if (options.healthServer) {
    const closed = once(options.healthServer, 'close');
    options.healthServer.close();
    await closed;
  }
}
