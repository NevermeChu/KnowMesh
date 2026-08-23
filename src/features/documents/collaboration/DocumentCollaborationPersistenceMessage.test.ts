import { describe, expect, it } from 'vitest';
import {
  createDocumentCollaborationPersistenceMessage,
  parseDocumentCollaborationPersistenceMessage,
} from './DocumentCollaborationPersistenceMessage';

describe('document collaboration persistence message', () => {
  it('round trips persistence states', () => {
    expect(
      parseDocumentCollaborationPersistenceMessage(
        createDocumentCollaborationPersistenceMessage('saved'),
      ),
    ).toStrictEqual({ status: 'saved', type: 'document-persistence' });
    expect(
      parseDocumentCollaborationPersistenceMessage(
        createDocumentCollaborationPersistenceMessage('error'),
      ),
    ).toStrictEqual({ status: 'error', type: 'document-persistence' });
  });

  it('rejects unrelated stateless payloads', () => {
    expect(parseDocumentCollaborationPersistenceMessage('not-json')).toBeNull();
    expect(
      parseDocumentCollaborationPersistenceMessage(
        JSON.stringify({ status: 'saved', type: 'other-message' }),
      ),
    ).toBeNull();
  });
});
