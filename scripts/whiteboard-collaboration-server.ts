import { once } from 'node:events';
import process from 'node:process';
import { acquireWhiteboardCollaborationLease } from '@/features/whiteboards/collaboration/WhiteboardCollaborationLease';
import type { WhiteboardCollaborationLease } from '@/features/whiteboards/collaboration/WhiteboardCollaborationLease';
import { createWhiteboardCollaborationServer } from '@/features/whiteboards/collaboration/WhiteboardCollaborationServer';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';

const preparationMode = process.argv.includes('--prepare');
if (Env.WHITEBOARD_COLLABORATION_ENABLED !== 'true' && !preparationMode) {
  throw new Error('白板协作服务未启用');
}

const service = createWhiteboardCollaborationServer({
  allowedOrigin: new URL(Env.NEXT_PUBLIC_APP_URL).origin,
});
let lease: WhiteboardCollaborationLease | undefined;
let shutdownPromise: Promise<void> | undefined;

const shutdown = async (signal: NodeJS.Signals) => {
  shutdownPromise ??= (async () => {
    console.info(JSON.stringify({ event: 'whiteboard_collaboration_stopping', signal }));
    try {
      await service.stop();
      await lease?.release();
      console.info(JSON.stringify({ event: 'whiteboard_collaboration_stopped', signal }));
    } finally {
      lease = undefined;
      await db.$client.end();
      if (process.connected) {
        process.disconnect?.();
      }
    }
  })();
  await shutdownPromise;
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.on('message', (message) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'shutdown'
  ) {
    void shutdown('SIGTERM');
  }
});

void (async () => {
  try {
    lease = await acquireWhiteboardCollaborationLease({
      onLost: (error) => {
        console.error(
          JSON.stringify({ error: error.message, event: 'whiteboard_collaboration_lease_lost' }),
        );
        void shutdown('SIGTERM');
      },
    });
    if (!preparationMode) {
      await service.invalidationSubscriber.start();
    }
    service.websocketServer.listen(
      Env.WHITEBOARD_COLLABORATION_PORT,
      Env.WHITEBOARD_COLLABORATION_ADDRESS,
    );
    service.healthServer.listen(
      Env.WHITEBOARD_COLLABORATION_HEALTH_PORT,
      Env.WHITEBOARD_COLLABORATION_ADDRESS,
    );
    await Promise.all([
      once(service.websocketServer, 'listening'),
      once(service.healthServer, 'listening'),
    ]);
    console.info(
      JSON.stringify({
        address: Env.WHITEBOARD_COLLABORATION_ADDRESS,
        event: 'whiteboard_collaboration_started',
        healthPort: Env.WHITEBOARD_COLLABORATION_HEALTH_PORT,
        port: Env.WHITEBOARD_COLLABORATION_PORT,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown startup error',
        event: 'whiteboard_collaboration_startup_failed',
      }),
    );
    try {
      await lease?.release();
    } finally {
      await db.$client.end();
      process.exitCode = 1;
    }
  }
})();
