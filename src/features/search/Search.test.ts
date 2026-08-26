import { describe, expect, it } from 'vitest';
import { extractPlainText } from './Search';

describe('search text extraction utils', () => {
  it('extracts plain text from nested ProseMirror document tree', () => {
    const documentNode = {
      content: [
        {
          content: [
            { text: '欢迎使用', type: 'text' },
            { text: ' KnowMesh ', type: 'text' },
            { text: '知识空间', type: 'text' },
          ],
          type: 'paragraph',
        },
        {
          content: [{ text: '沉淀团队上下文。', type: 'text' }],
          type: 'paragraph',
        },
      ],
      type: 'doc',
    };

    expect(extractPlainText(documentNode)).toBe('欢迎使用 KnowMesh 知识空间 沉淀团队上下文。');
  });

  it('handles invalid or empty document nodes gracefully', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText('')).toBe('');
    expect(extractPlainText({})).toBe('');
    expect(extractPlainText({ type: 'doc' })).toBe('');
  });
});
