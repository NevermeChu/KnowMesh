import { describe, expect, it } from 'vitest';
import { createDocumentSchema, moveDocumentSchema, updateDocumentSchema } from './DocumentSchema';

const documentId = '01987654-3210-7000-8000-000000000001';
const expectedUpdatedAt = new Date('2026-08-25T00:00:00.000Z');

describe('document schemas', () => {
  it('rejects non-document JSON', () => {
    expect(() =>
      updateDocumentSchema.parse({ content: { type: 'paragraph' }, documentId, expectedUpdatedAt }),
    ).toThrow('文档内容格式无效');
  });

  it('rejects nodes outside configured editor schema', () => {
    expect(() =>
      updateDocumentSchema.parse({
        content: { content: [{ type: 'unsupportedBlock' }], type: 'doc' },
        documentId,
        expectedUpdatedAt,
      }),
    ).toThrow('文档内容格式无效');
  });

  it('accepts callout and details blocks in document schema', () => {
    const validContent = {
      content: [
        {
          attrs: { type: 'info' },
          content: [{ content: [{ text: '提示信息', type: 'text' }], type: 'paragraph' }],
          type: 'callout',
        },
        {
          content: [
            { content: [{ text: '折叠标题', type: 'text' }], type: 'detailsSummary' },
            {
              content: [{ content: [{ text: '折叠正文', type: 'text' }], type: 'paragraph' }],
              type: 'detailsContent',
            },
          ],
          type: 'details',
        },
      ],
      type: 'doc',
    };

    expect(
      updateDocumentSchema.parse({
        content: validContent,
        documentId,
        expectedUpdatedAt,
      }),
    ).toStrictEqual({
      content: validContent,
      documentId,
      expectedUpdatedAt,
    });
  });

  it('rejects content saves without a version token', () => {
    expect(() =>
      updateDocumentSchema.parse({
        content: { content: [{ type: 'paragraph' }], type: 'doc' },
        documentId,
      }),
    ).toThrow('保存文档正文时缺少版本信息');
  });

  it('rejects title saves without a version token', () => {
    expect(() => updateDocumentSchema.parse({ documentId, title: '新标题' })).toThrow(
      '保存文档标题时缺少版本信息',
    );
  });

  it('defaults created documents to rich-text and rejects invalid ids', () => {
    const projectId = '01987654-3210-7000-8000-000000000002';

    expect(
      createDocumentSchema.parse({
        projectId,
        title: '根文档',
      }),
    ).toMatchObject({
      kind: 'rich-text',
      projectId,
      title: '根文档',
    });

    expect(() =>
      createDocumentSchema.parse({
        projectId: 'invalid-uuid',
        title: '文档',
      }),
    ).toThrow(/invalid/iu);
  });

  it('rejects relative moves without a target document', () => {
    const projectId = '01987654-3210-7000-8000-000000000002';

    expect(() =>
      moveDocumentSchema.parse({
        documentId,
        position: 'before',
        targetParentId: null,
        targetProjectId: projectId,
      }),
    ).toThrow('相对移动缺少目标文档');
  });
});
