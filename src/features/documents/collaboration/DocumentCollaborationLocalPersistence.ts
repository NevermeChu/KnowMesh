import { DOCUMENT_CONTENT_SCHEMA_VERSION } from '../Document';

const DOCUMENT_COLLABORATION_CACHE_PREFIX = 'knowmesh';

const getDocumentCollaborationUserCachePrefix = (userId: string) =>
  `${DOCUMENT_COLLABORATION_CACHE_PREFIX}:${userId}:`;

/**
 * Builds the browser-local collaboration cache namespace for one user and document.
 *
 * @param options - Stable user and document boundaries.
 * @returns A versioned IndexedDB database name.
 */
export function getDocumentCollaborationCacheName(options: { documentId: string; userId: string }) {
  return `${DOCUMENT_COLLABORATION_CACHE_PREFIX}:${options.userId}:${options.documentId}:v${DOCUMENT_CONTENT_SCHEMA_VERSION}`;
}

export function isDocumentCollaborationCacheNameForUser(options: {
  cacheName: string;
  userId: string;
}) {
  return options.cacheName.startsWith(getDocumentCollaborationUserCachePrefix(options.userId));
}

async function deleteIndexedDatabase(name: string) {
  // IndexedDB exposes event-based requests, so this boundary intentionally adapts one to a Promise.
  // oxlint-disable-next-line promise/avoid-new -- IndexedDB has no promise-returning deletion API.
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener(
      'success',
      () => {
        resolve();
      },
      { once: true },
    );
    request.addEventListener(
      'error',
      () => {
        reject(request.error ?? new Error('IndexedDB deletion failed'));
      },
      { once: true },
    );
    request.addEventListener(
      'blocked',
      () => {
        reject(new Error('IndexedDB deletion is blocked'));
      },
      {
        once: true,
      },
    );
  });
}

/**
 * Clears only one user's local Team-document recovery databases during account exit.
 *
 * @param userId - Better Auth user boundary encoded in every collaboration cache name.
 * @returns Whether browser enumeration and all matching deletions succeeded.
 */
export async function clearDocumentCollaborationCachesForUser(userId: string) {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
    return false;
  }

  try {
    const databases = await indexedDB.databases();
    const names = databases.flatMap((database) =>
      database.name && isDocumentCollaborationCacheNameForUser({ cacheName: database.name, userId })
        ? [database.name]
        : [],
    );
    await Promise.all(
      names.map(async (name) => {
        await deleteIndexedDatabase(name);
      }),
    );
    return true;
  } catch {
    console.error('Document collaboration local cache cleanup failed');
    return false;
  }
}
