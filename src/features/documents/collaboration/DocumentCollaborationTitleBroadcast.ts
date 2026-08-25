import { getDocumentCollaborationRoom } from './DocumentCollaborationRoom';
import { createDocumentCollaborationTitleMessage } from './DocumentCollaborationTitleMessage';

type StatelessDocument = {
  broadcastStateless: (payload: string) => void;
};

export function broadcastDocumentCollaborationTitle(
  documents: ReadonlyMap<string, StatelessDocument>,
  update: {
    documentId: string;
    title: string;
    titleVersion: number;
  },
) {
  documents
    .get(getDocumentCollaborationRoom(update.documentId))
    ?.broadcastStateless(createDocumentCollaborationTitleMessage(update));
}
