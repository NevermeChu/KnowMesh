import { acquireCollaborationLease } from '@/features/collaboration/CollaborationLease';
import type { CollaborationLease } from '@/features/collaboration/CollaborationLease';

const COLLABORATION_LOCK_NAMESPACE = 1_264_546_647;
const COLLABORATION_LOCK_ID = 1_294_280_520;

export type DocumentCollaborationLease = CollaborationLease;

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
  return await acquireCollaborationLease({
    ...options,
    lockId: COLLABORATION_LOCK_ID,
    lockNamespace: COLLABORATION_LOCK_NAMESPACE,
    serviceName: '协作服务',
  });
}
