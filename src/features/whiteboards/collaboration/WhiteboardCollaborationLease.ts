import { acquireCollaborationLease } from '@/features/collaboration/CollaborationLease';
import type { CollaborationLease } from '@/features/collaboration/CollaborationLease';

const WHITEBOARD_LOCK_NAMESPACE = 1_264_546_647;
const WHITEBOARD_LOCK_ID = 1_463_968_322;

export type WhiteboardCollaborationLease = CollaborationLease;

/**
 * Acquires the database-wide lease that permits exactly one whiteboard collaboration writer.
 *
 * @param options - Callback invoked if the lease connection is lost.
 * @returns A lease that must remain held until whiteboard collaboration shutdown completes.
 * @throws Error when another whiteboard collaboration process already owns the lease.
 */
export async function acquireWhiteboardCollaborationLease(options: {
  onLost: (error: Error) => void;
}) {
  return await acquireCollaborationLease({
    ...options,
    lockId: WHITEBOARD_LOCK_ID,
    lockNamespace: WHITEBOARD_LOCK_NAMESPACE,
    serviceName: '白板协作服务',
  });
}
