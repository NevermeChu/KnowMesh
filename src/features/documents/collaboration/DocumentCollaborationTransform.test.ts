import { TiptapTransformer } from '@hocuspocus/transformer';
import { describe, expect, it } from 'vitest';
import type { DocumentContent } from '../Document';
import { documentExtensions } from '../DocumentExtensions';
import {
  decodeDocumentCollaborationState,
  documentContentToYDoc,
  encodeDocumentCollaborationState,
  repairLegacyDocumentCollaborationField,
  yDocToDocumentContent,
} from './DocumentCollaborationTransform';

const richDocument: DocumentContent = {
  content: [
    {
      content: [
        { marks: [{ type: 'bold' }], text: '正文', type: 'text' },
        { type: 'hardBreak' },
        {
          marks: [{ attrs: { href: 'https://example.com' }, type: 'link' }],
          text: '链接',
          type: 'text',
        },
      ],
      type: 'paragraph',
    },
    { attrs: { level: 2 }, content: [{ text: '标题', type: 'text' }], type: 'heading' },
    {
      attrs: { type: 'warning' },
      content: [{ content: [{ text: '提示', type: 'text' }], type: 'paragraph' }],
      type: 'callout',
    },
    {
      content: [
        { content: [{ text: '摘要', type: 'text' }], type: 'detailsSummary' },
        {
          content: [{ content: [{ text: '详情', type: 'text' }], type: 'paragraph' }],
          type: 'detailsContent',
        },
      ],
      type: 'details',
    },
    {
      content: [
        {
          attrs: { checked: true },
          content: [{ content: [{ text: '任务', type: 'text' }], type: 'paragraph' }],
          type: 'taskItem',
        },
      ],
      type: 'taskList',
    },
    { type: 'horizontalRule' },
  ],
  type: 'doc',
};

describe('document collaboration transform', () => {
  it('round-trips configured nodes and marks', () => {
    const collaborationDocument = documentContentToYDoc(richDocument);
    const normalizedContent = yDocToDocumentContent(collaborationDocument);
    const restoredDocument = decodeDocumentCollaborationState(
      encodeDocumentCollaborationState(collaborationDocument),
    );

    expect(JSON.stringify(yDocToDocumentContent(restoredDocument))).toBe(
      JSON.stringify(normalizedContent),
    );
  });

  it('repairs content written to the legacy default field', () => {
    const legacyDocument = TiptapTransformer.toYdoc(richDocument, 'default', documentExtensions);
    const restoredLegacyDocument = decodeDocumentCollaborationState(
      encodeDocumentCollaborationState(legacyDocument),
    );

    const repairedDocument = repairLegacyDocumentCollaborationField(restoredLegacyDocument);

    expect(yDocToDocumentContent(repairedDocument)).toStrictEqual(
      yDocToDocumentContent(documentContentToYDoc(richDocument)),
    );
    expect(repairedDocument.share.has('default')).toBeFalsy();
  });
});
