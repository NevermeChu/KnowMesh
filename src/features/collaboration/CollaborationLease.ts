import type { PoolClient } from 'pg';
import { db } from '@/libs/DB';

export type CollaborationLease = {
  release: () => Promise<void>;
};

async function releaseAdvisoryLock(options: {
  client: PoolClient;
  lockId: number;
  lockNamespace: number;
  serviceName: string;
}) {
  const result = await options.client.query<{ released: boolean }>(
    'SELECT pg_advisory_unlock($1, $2) AS released',
    [options.lockNamespace, options.lockId],
  );

  if (!result.rows[0]?.released) {
    throw new Error(`${options.serviceName}数据库租约释放失败`);
  }
}

/**
 * Acquires an independent database-wide single-writer lease.
 *
 * @param options - Advisory-lock identity, service label, and lease-loss callback.
 * @returns A lease that remains valid while its PostgreSQL connection is held.
 */
export async function acquireCollaborationLease(options: {
  lockId: number;
  lockNamespace: number;
  onLost: (error: Error) => void;
  serviceName: string;
}): Promise<CollaborationLease> {
  const client = await db.$client.connect();
  let released = false;
  const handleError = (error: Error) => {
    if (!released) {
      options.onLost(error);
    }
  };
  const handleEnd = () => {
    if (!released) {
      options.onLost(new Error(`${options.serviceName}数据库租约连接已断开`));
    }
  };

  client.on('end', handleEnd);
  client.on('error', handleError);

  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      [options.lockNamespace, options.lockId],
    );
    if (!result.rows[0]?.acquired) {
      throw new Error(`已有${options.serviceName}实例持有数据库租约`);
    }
  } catch (error) {
    client.off('end', handleEnd);
    client.off('error', handleError);
    client.release(true);
    throw error;
  }

  return {
    async release() {
      if (released) {
        return;
      }
      released = true;
      client.off('end', handleEnd);
      client.off('error', handleError);
      try {
        await releaseAdvisoryLock({ client, ...options });
        client.release();
      } catch (error) {
        client.release(true);
        throw error;
      }
    },
  };
}
