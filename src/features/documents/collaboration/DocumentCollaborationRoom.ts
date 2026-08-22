import * as z from 'zod';

const documentIdSchema = z.uuid();
const roomPrefix = 'document:';

export function getDocumentIdFromCollaborationRoom(documentName: string) {
  if (!documentName.startsWith(roomPrefix)) {
    throw new Error('协作文档房间名称无效');
  }

  return documentIdSchema.parse(documentName.slice(roomPrefix.length));
}

export function getDocumentCollaborationRoom(documentId: string) {
  return `${roomPrefix}${documentIdSchema.parse(documentId)}`;
}
