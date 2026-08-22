type CollaborationMetricsSnapshot = {
  activeConnections: number;
  activeDocuments: number;
  authenticationFailures: number;
  consecutiveStoreFailures: number;
  documentChanges: number;
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

  recordStoreFailure() {
    this.consecutiveStoreFailures += 1;
    this.storeFailures += 1;
  }

  recordStoreSuccess() {
    this.consecutiveStoreFailures = 0;
    this.lastStoreSuccessAt = new Date().toISOString();
    this.storeSuccesses += 1;
  }

  isStoreReady() {
    return this.consecutiveStoreFailures === 0;
  }

  snapshot(options: { activeConnections: number; activeDocuments: number }) {
    return {
      ...options,
      authenticationFailures: this.authenticationFailures,
      consecutiveStoreFailures: this.consecutiveStoreFailures,
      documentChanges: this.documentChanges,
      invalidatedConnections: this.invalidatedConnections,
      lastStoreSuccessAt: this.lastStoreSuccessAt,
      projectionFailures: this.projectionFailures,
      readOnlyWriteRejections: this.readOnlyWriteRejections,
      storeFailures: this.storeFailures,
      storeSuccesses: this.storeSuccesses,
    } satisfies CollaborationMetricsSnapshot;
  }
}
