import type { Notification, PoolClient } from 'pg';
import * as z from 'zod';
import { db } from '@/libs/DB';

const COLLABORATION_INVALIDATION_CHANNEL = 'knowmesh_document_collaboration';
const RETRY_DELAY_MS = 1000;

export const documentCollaborationInvalidationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('document'),
    documentId: z.uuid(),
  }),
  z.object({
    kind: z.literal('project_member'),
    projectId: z.uuid(),
    userId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('session'),
    sessionId: z.string().min(1),
    userId: z.string().min(1),
  }),
]);

export type DocumentCollaborationInvalidation = z.infer<
  typeof documentCollaborationInvalidationSchema
>;

export class DocumentCollaborationInvalidationSubscriber {
  private client: PoolClient | null = null;
  private readonly invalidate: (
    invalidation: DocumentCollaborationInvalidation,
  ) => Promise<void> | void;
  private retryTimer: NodeJS.Timeout | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    invalidate: (invalidation: DocumentCollaborationInvalidation) => Promise<void> | void,
  ) {
    this.invalidate = invalidate;
  }

  async start() {
    this.startPromise ??= this.connect();
    try {
      await this.startPromise;
    } catch (error) {
      this.resetConnection();
      throw error;
    }
  }

  stop() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.resetConnection();
  }

  private async connect() {
    const client = await db.$client.connect();
    this.client = client;
    client.on('error', this.handleConnectionError);
    client.on('notification', this.handleNotification);
    await client.query(`LISTEN ${COLLABORATION_INVALIDATION_CHANNEL}`);
  }

  private readonly handleConnectionError = () => {
    this.resetConnection();
    this.retryTimer ??= setTimeout(() => {
      this.retryTimer = null;
      void this.restart();
    }, RETRY_DELAY_MS);
  };

  private readonly handleNotification = (message: Notification) => {
    if (message.channel !== COLLABORATION_INVALIDATION_CHANNEL || !message.payload) {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(message.payload);
    } catch {
      return;
    }

    const invalidation = documentCollaborationInvalidationSchema.safeParse(payload);
    if (!invalidation.success) {
      return;
    }

    void this.invalidateSafely(invalidation.data);
  };

  private async invalidateSafely(invalidation: DocumentCollaborationInvalidation) {
    try {
      await this.invalidate(invalidation);
    } catch (error) {
      console.error(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown invalidation error',
          event: 'document_collaboration_invalidation_failed',
          kind: invalidation.kind,
        }),
      );
    }
  }

  private async restart() {
    try {
      await this.start();
    } catch {
      this.handleConnectionError();
    }
  }

  private resetConnection() {
    if (this.client) {
      this.client.off('error', this.handleConnectionError);
      this.client.off('notification', this.handleNotification);
      this.client.release(true);
      this.client = null;
    }
    this.startPromise = null;
  }
}
