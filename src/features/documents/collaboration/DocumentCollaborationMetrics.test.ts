import { describe, expect, it } from 'vitest';
import { DocumentCollaborationMetrics } from './DocumentCollaborationMetrics';

describe(DocumentCollaborationMetrics, () => {
  it('keeps readiness degraded until each failed document recovers', () => {
    const metrics = new DocumentCollaborationMetrics();

    metrics.recordStoreFailure('document-a');
    metrics.recordStoreSuccess('document-b');

    expect(metrics.isStoreReady()).toBeFalsy();
    expect(metrics.snapshot({ activeConnections: 0, activeDocuments: 0 }).failedDocuments).toBe(1);

    metrics.recordStoreSuccess('document-a');

    expect(metrics.isStoreReady()).toBeTruthy();
  });
});
