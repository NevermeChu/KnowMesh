import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearDocument, IndexeddbPersistence, storeState } from 'y-indexeddb';
import * as Y from 'yjs';
import { DOCUMENT_CONTENT_SCHEMA_VERSION } from '../Document';
import {
  getDocumentCollaborationCacheName,
  isDocumentCollaborationCacheNameForUser,
} from './DocumentCollaborationLocalPersistence';

const recoveryCacheName = 'knowmesh:user-recovery:document-recovery:v1';

describe(getDocumentCollaborationCacheName, () => {
  beforeAll(() => {
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    vi.stubGlobal('indexedDB', indexedDB);
  });

  afterEach(async () => {
    await clearDocument(recoveryCacheName);
  });

  it('isolates cache by user document and schema version', () => {
    expect(getDocumentCollaborationCacheName({ documentId: 'document-1', userId: 'user-1' })).toBe(
      `knowmesh:user-1:document-1:v${DOCUMENT_CONTENT_SCHEMA_VERSION}`,
    );
    expect(
      getDocumentCollaborationCacheName({ documentId: 'document-1', userId: 'user-2' }),
    ).not.toBe(getDocumentCollaborationCacheName({ documentId: 'document-1', userId: 'user-1' }));
  });

  it('matches only the exact user namespace', () => {
    expect(
      isDocumentCollaborationCacheNameForUser({
        cacheName: 'knowmesh:user-1:document-1:v1',
        userId: 'user-1',
      }),
    ).toBeTruthy();
    expect(
      isDocumentCollaborationCacheNameForUser({
        cacheName: 'knowmesh:user-10:document-1:v1',
        userId: 'user-1',
      }),
    ).toBeFalsy();
  });

  it('restores an unacknowledged Yjs update from the browser replica', async () => {
    const sourceDocument = new Y.Doc();
    const sourcePersistence = new IndexeddbPersistence(recoveryCacheName, sourceDocument);
    await sourcePersistence.whenSynced;
    sourceDocument.getText('content').insert(0, 'hard-crash recovery');
    await storeState(sourcePersistence);
    await sourcePersistence.destroy();
    sourceDocument.destroy();

    const restoredDocument = new Y.Doc();
    const restoredPersistence = new IndexeddbPersistence(recoveryCacheName, restoredDocument);
    await restoredPersistence.whenSynced;

    expect(restoredDocument.getText('content').toJSON()).toBe('hard-crash recovery');

    await restoredPersistence.destroy();
    restoredDocument.destroy();
  });
});
