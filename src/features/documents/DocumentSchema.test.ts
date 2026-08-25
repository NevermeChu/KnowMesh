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

  it('validates createDocumentSchema with and without parentId', () => {
    const projectId = '01987654-3210-7000-8000-000000000002';
    const parentId = '01987654-3210-7000-8000-000000000003';

    expect(
      createDocumentSchema.parse({
        projectId,
        title: '根文档',
      }),
    ).toStrictEqual({
      projectId,
      title: '根文档',
    });

    expect(
      createDocumentSchema.parse({
        parentId,
        projectId,
        title: '子文档',
      }),
    ).toStrictEqual({
      parentId,
      projectId,
      title: '子文档',
    });

    expect(() =>
      createDocumentSchema.parse({
        projectId: 'invalid-uuid',
        title: '文档',
      }),
    ).toThrow(/invalid/iu);
  });

  it('validates moveDocumentSchema inputs', () => {
    const projectId = '01987654-3210-7000-8000-000000000002';
    const parentId = '01987654-3210-7000-8000-000000000003';

    expect(
      moveDocumentSchema.parse({
        documentId,
        sortOrder: 500,
        targetParentId: parentId,
        targetProjectId: projectId,
      }),
    ).toStrictEqual({
      documentId,
      sortOrder: 500,
      targetParentId: parentId,
      targetProjectId: projectId,
    });

    expect(
      moveDocumentSchema.parse({
        documentId,
        targetParentId: null,
        targetProjectId: projectId,
      }),
    ).toStrictEqual({
      documentId,
      targetParentId: null,
      targetProjectId: projectId,
    });

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
