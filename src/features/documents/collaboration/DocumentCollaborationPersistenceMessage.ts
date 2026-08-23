export type DocumentCollaborationPersistenceMessage = {
  status: 'error' | 'saved';
  type: 'document-persistence';
};

export function createDocumentCollaborationPersistenceMessage(
  status: DocumentCollaborationPersistenceMessage['status'],
) {
  return JSON.stringify({ status, type: 'document-persistence' });
}

export function parseDocumentCollaborationPersistenceMessage(
  payload: string,
): DocumentCollaborationPersistenceMessage | null {
  let value: unknown;

  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }

  if (
    !value ||
    typeof value !== 'object' ||
    !('status' in value) ||
    !('type' in value) ||
    value.type !== 'document-persistence' ||
    (value.status !== 'error' && value.status !== 'saved')
  ) {
    return null;
  }

  return { status: value.status, type: value.type };
}
