import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import type { DocumentContent } from '../Document';
import { documentExtensions } from '../DocumentExtensions';
import { isDocumentContent } from '../DocumentSchema';

export const DOCUMENT_COLLABORATION_FIELD = 'content';
const LEGACY_DOCUMENT_COLLABORATION_FIELD = 'default';

function yDocFieldToDocumentContent(document: Y.Doc, field: string) {
  const content: unknown = TiptapTransformer.fromYdoc(document, field);

  if (!isDocumentContent(content)) {
    throw new Error('协作文档无法生成有效的正文快照');
  }

  return content;
}

export function documentContentToYDoc(content: DocumentContent) {
  return TiptapTransformer.toYdoc(content, DOCUMENT_COLLABORATION_FIELD, documentExtensions);
}

export function yDocToDocumentContent(document: Y.Doc) {
  return yDocFieldToDocumentContent(document, DOCUMENT_COLLABORATION_FIELD);
}

export function repairLegacyDocumentCollaborationField(document: Y.Doc) {
  if (!document.share.has(LEGACY_DOCUMENT_COLLABORATION_FIELD)) {
    return document;
  }

  const legacyFragment = document.getXmlFragment(LEGACY_DOCUMENT_COLLABORATION_FIELD);
  if (legacyFragment.length === 0) {
    return document;
  }

  return documentContentToYDoc(
    yDocFieldToDocumentContent(document, LEGACY_DOCUMENT_COLLABORATION_FIELD),
  );
}

export function encodeDocumentCollaborationState(document: Y.Doc) {
  return Y.encodeStateAsUpdate(document);
}

export function decodeDocumentCollaborationState(state: Uint8Array) {
  const document = new Y.Doc();
  Y.applyUpdate(document, state);
  return document;
}
