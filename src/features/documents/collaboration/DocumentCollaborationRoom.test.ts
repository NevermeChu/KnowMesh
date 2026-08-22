import { describe, expect, it } from 'vitest';
import {
  getDocumentCollaborationRoom,
  getDocumentIdFromCollaborationRoom,
} from './DocumentCollaborationRoom';

const documentId = '30000000-0000-4000-8000-000000000001';

describe('document collaboration room', () => {
  it('round-trips document room names', () => {
    expect(getDocumentIdFromCollaborationRoom(getDocumentCollaborationRoom(documentId))).toBe(
      documentId,
    );
  });

  it.each(['document:not-a-uuid', `project:${documentId}`])(
    'rejects invalid room name %s',
    (room) => {
      expect(() => getDocumentIdFromCollaborationRoom(room)).toThrow(/.+/u);
    },
  );
});
