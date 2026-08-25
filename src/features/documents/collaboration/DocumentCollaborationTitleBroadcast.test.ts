import { describe, expect, it, vi } from 'vitest';
import { getDocumentCollaborationRoom } from './DocumentCollaborationRoom';
import { broadcastDocumentCollaborationTitle } from './DocumentCollaborationTitleBroadcast';
import { parseDocumentCollaborationTitleMessage } from './DocumentCollaborationTitleMessage';

describe(broadcastDocumentCollaborationTitle, () => {
  it('broadcasts title updates only to the matching document room', () => {
    const targetBroadcast = vi.fn<(payload: string) => void>();
    const otherBroadcast = vi.fn<(payload: string) => void>();
    const documentId = '11111111-1111-4111-8111-111111111111';
    const otherDocumentId = '22222222-2222-4222-8222-222222222222';

    broadcastDocumentCollaborationTitle(
      new Map([
        [getDocumentCollaborationRoom(documentId), { broadcastStateless: targetBroadcast }],
        [getDocumentCollaborationRoom(otherDocumentId), { broadcastStateless: otherBroadcast }],
      ]),
      { documentId, title: 'Updated title', titleVersion: 2 },
    );

    expect(targetBroadcast).toHaveBeenCalledOnce();
    const payload = targetBroadcast.mock.calls[0]?.[0];
    if (!payload) {
      throw new Error('Expected a title broadcast payload');
    }
    expect(parseDocumentCollaborationTitleMessage(payload)).toStrictEqual({
      documentId,
      title: 'Updated title',
      titleVersion: 2,
      type: 'document-title',
    });
    expect(otherBroadcast).not.toHaveBeenCalled();
  });
});
