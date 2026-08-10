import { describe, expect, it } from 'vitest';
import { updateDocumentSchema } from './DocumentSchema';

const documentId = '01987654-3210-7000-8000-000000000001';

describe('document schemas', () => {
  it('accepts ProseMirror document content', () => {
    expect(
      updateDocumentSchema.parse({
        content: {
          content: [
            {
              content: [{ marks: [{ type: 'bold' }], text: '知识', type: 'text' }],
              type: 'paragraph',
            },
          ],
          type: 'doc',
        },
        documentId,
      }),
    ).toStrictEqual({
      content: {
        content: [
          {
            content: [{ marks: [{ type: 'bold' }], text: '知识', type: 'text' }],
            type: 'paragraph',
          },
        ],
        type: 'doc',
      },
      documentId,
    });
  });

  it('rejects non-document JSON', () => {
    expect(() =>
      updateDocumentSchema.parse({ content: { type: 'paragraph' }, documentId }),
    ).toThrow('文档内容格式无效');
  });

  it('rejects nodes outside configured editor schema', () => {
    expect(() =>
      updateDocumentSchema.parse({
        content: { content: [{ type: 'unsupportedBlock' }], type: 'doc' },
        documentId,
      }),
    ).toThrow('文档内容格式无效');
  });

  it('rejects invalid node nesting', () => {
    expect(() =>
      updateDocumentSchema.parse({
        content: {
          content: [{ content: [{ type: 'paragraph' }], type: 'paragraph' }],
          type: 'doc',
        },
        documentId,
      }),
    ).toThrow('文档内容格式无效');
  });
});
