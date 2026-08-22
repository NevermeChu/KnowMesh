import { once } from 'node:events';
import process from 'node:process';
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
