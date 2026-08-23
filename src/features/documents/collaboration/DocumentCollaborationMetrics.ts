type CollaborationMetricsSnapshot = {
  activeConnections: number;
  activeDocuments: number;
  authenticationFailures: number;
  consecutiveStoreFailures: number;
  documentChanges: number;
  failedDocuments: number;
  invalidatedConnections: number;
  lastStoreSuccessAt: string | null;
  projectionFailures: number;
  readOnlyWriteRejections: number;
  storeFailures: number;
  storeSuccesses: number;
};

export class DocumentCollaborationMetrics {
  private authenticationFailures = 0;
  private consecutiveStoreFailures = 0;
  private documentChanges = 0;
  private readonly failedDocumentIds = new Set<string>();
  private invalidatedConnections = 0;
  private lastStoreSuccessAt: string | null = null;
  private projectionFailures = 0;
  private readOnlyWriteRejections = 0;
  private storeFailures = 0;
  private storeSuccesses = 0;

  recordAuthenticationFailure() {
    this.authenticationFailures += 1;
  }

  recordInvalidatedConnection() {
    this.invalidatedConnections += 1;
  }

  recordDocumentChange() {
    this.documentChanges += 1;
  }

  recordProjectionFailure() {
    this.projectionFailures += 1;
  }

  recordReadOnlyWriteRejection() {
    this.readOnlyWriteRejections += 1;
  }

  recordStoreFailure(documentId: string) {
    this.consecutiveStoreFailures += 1;
    this.failedDocumentIds.add(documentId);
    this.storeFailures += 1;
  }

  recordStoreSuccess(documentId: string) {
    this.consecutiveStoreFailures = 0;
    this.failedDocumentIds.delete(documentId);
    this.lastStoreSuccessAt = new Date().toISOString();
    this.storeSuccesses += 1;
  }

  isStoreReady() {
    return this.failedDocumentIds.size === 0;
  }

  snapshot(options: { activeConnections: number; activeDocuments: number }) {
    return {
      ...options,
      authenticationFailures: this.authenticationFailures,
      consecutiveStoreFailures: this.consecutiveStoreFailures,
      documentChanges: this.documentChanges,
      failedDocuments: this.failedDocumentIds.size,
      invalidatedConnections: this.invalidatedConnections,
      lastStoreSuccessAt: this.lastStoreSuccessAt,
      projectionFailures: this.projectionFailures,
      readOnlyWriteRejections: this.readOnlyWriteRejections,
      storeFailures: this.storeFailures,
      storeSuccesses: this.storeSuccesses,
    } satisfies CollaborationMetricsSnapshot;
  }
}
