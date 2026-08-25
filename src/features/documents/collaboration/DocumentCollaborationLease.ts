import type { PoolClient } from 'pg';
import { db } from '@/libs/DB';

const COLLABORATION_LOCK_NAMESPACE = 1_264_546_647;
const COLLABORATION_LOCK_ID = 1_294_280_520;

export type DocumentCollaborationLease = {
  release: () => Promise<void>;
};

async function releaseAdvisoryLock(client: PoolClient) {
  const result = await client.query<{ released: boolean }>(
    'SELECT pg_advisory_unlock($1, $2) AS released',
    [COLLABORATION_LOCK_NAMESPACE, COLLABORATION_LOCK_ID],
  );

  if (!result.rows[0]?.released) {
    throw new Error('协作服务数据库租约释放失败');
  }
}

/**
 * Acquires the database-wide lease that permits exactly one collaboration writer.
 *
 * @param options - Callback invoked if the lease connection is lost.
 * @returns A lease that must remain held until collaboration shutdown completes.
 * @throws Error when another collaboration process already owns the lease.
 */
export async function acquireDocumentCollaborationLease(options: {
  onLost: (error: Error) => void;
}): Promise<DocumentCollaborationLease> {
  const client = await db.$client.connect();
  let released = false;
  const handleError = (error: Error) => {
    if (!released) {
      options.onLost(error);
    }
  };
  const handleEnd = () => {
    if (!released) {
      options.onLost(new Error('协作服务数据库租约连接已断开'));
    }
  };

  client.on('end', handleEnd);
  client.on('error', handleError);

  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      [COLLABORATION_LOCK_NAMESPACE, COLLABORATION_LOCK_ID],
    );

    if (!result.rows[0]?.acquired) {
      throw new Error('已有协作服务实例持有数据库租约');
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
        await releaseAdvisoryLock(client);
        client.release();
      } catch (error) {
        client.release(true);
        throw error;
      }
    },
  };
}
