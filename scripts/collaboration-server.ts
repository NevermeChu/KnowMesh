import { once } from 'node:events';
import process from 'node:process';
import { acquireDocumentCollaborationLease } from '@/features/documents/collaboration/DocumentCollaborationLease';
import type { DocumentCollaborationLease } from '@/features/documents/collaboration/DocumentCollaborationLease';
import {
  createDocumentCollaborationHealthServer,
  createDocumentCollaborationServer,
  stopDocumentCollaborationServer,
} from '@/features/documents/collaboration/DocumentCollaborationServer';
import { assertDocumentCollaborationStartup } from '@/features/documents/collaboration/DocumentCollaborationStartup';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';

const preparationMode = process.argv.includes('--prepare');
assertDocumentCollaborationStartup({
  address: Env.COLLABORATION_ADDRESS,
  authenticationReady: true,
  enabled: Env.COLLABORATION_ENABLED === 'true',
  preparationMode,
});

const { invalidationSubscriber, metrics, server } = createDocumentCollaborationServer();
const healthServer = createDocumentCollaborationHealthServer({
  collaborationServer: server,
  metrics,
});
let shutdownPromise: Promise<void> | undefined;
let collaborationLease: DocumentCollaborationLease | undefined;

const isShutdownMessage = (value: unknown) =>
  typeof value === 'object' && value !== null && 'type' in value && value.type === 'shutdown';

const shutdown = async (signal: NodeJS.Signals) => {
  shutdownPromise ??= (async () => {
    console.info(JSON.stringify({ event: 'document_collaboration_stopping', signal }));
    try {
      await stopDocumentCollaborationServer({ healthServer, server });
      console.info(JSON.stringify({ event: 'document_collaboration_stopped', signal }));
    } catch (error) {
      console.error(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown shutdown error',
          event: 'document_collaboration_shutdown_failed',
          signal,
        }),
      );
      if (healthServer.listening) {
        const closed = once(healthServer, 'close');
        healthServer.close();
        await closed;
      }
      process.exitCode = 1;
    } finally {
      try {
        await collaborationLease?.release();
      } catch (error) {
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown lease release error',
            event: 'document_collaboration_lease_release_failed',
          }),
        );
        process.exitCode = 1;
      }
      collaborationLease = undefined;
      await db.$client.end();
      if (process.connected) {
        process.disconnect?.();
      }
    }
  })();
  await shutdownPromise;
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('message', (message) => {
  if (isShutdownMessage(message)) {
    void shutdown('SIGTERM');
  }
});

async function startCollaborationServer() {
  collaborationLease = await acquireDocumentCollaborationLease({
    onLost: (error) => {
      console.error(
        JSON.stringify({ error: error.message, event: 'document_collaboration_lease_lost' }),
      );
      void shutdown('SIGTERM');
    },
  });
  if (!preparationMode) {
    await invalidationSubscriber.start();
  }
  await server.listen();
  healthServer.listen(Env.COLLABORATION_HEALTH_PORT, Env.COLLABORATION_ADDRESS);
  await once(healthServer, 'listening');
  console.info(
    JSON.stringify({
      address: server.configuration.address,
      event: 'document_collaboration_started',
      healthPort: Env.COLLABORATION_HEALTH_PORT,
      port: server.address.port,
    }),
  );
}

void (async () => {
  try {
    await startCollaborationServer();
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown startup error',
        event: 'document_collaboration_startup_failed',
      }),
    );
    try {
      await collaborationLease?.release();
    } finally {
      collaborationLease = undefined;
      await db.$client.end();
    }
    process.exitCode = 1;
  }
})();
