export class WhiteboardCollaborationMetrics {
  private authenticationFailures = 0;
  private conflicts = 0;
  private invalidatedConnections = 0;
  private persistenceFailures = 0;
  private readonly failedDocumentIds = new Set<string>();
  private readOnlyWriteRejections = 0;
  private saves = 0;

  recordAuthenticationFailure() {
    this.authenticationFailures += 1;
  }

  recordConflict() {
    this.conflicts += 1;
  }

  recordInvalidatedConnection() {
    this.invalidatedConnections += 1;
  }

  recordPersistenceFailure(documentId: string) {
    this.persistenceFailures += 1;
    this.failedDocumentIds.add(documentId);
  }

  recordReadOnlyWriteRejection() {
    this.readOnlyWriteRejections += 1;
  }

  recordLoadSuccess(documentId: string) {
    this.failedDocumentIds.delete(documentId);
  }

  recordSave(documentId: string) {
    this.saves += 1;
    this.failedDocumentIds.delete(documentId);
  }

  isReady() {
    return this.failedDocumentIds.size === 0;
  }

  snapshot(options: { activeConnections: number; activeRooms: number }) {
    return {
      ...options,
      authenticationFailures: this.authenticationFailures,
      conflicts: this.conflicts,
      failedDocuments: this.failedDocumentIds.size,
      invalidatedConnections: this.invalidatedConnections,
      persistenceFailures: this.persistenceFailures,
      readOnlyWriteRejections: this.readOnlyWriteRejections,
      saves: this.saves,
    };
  }
}
