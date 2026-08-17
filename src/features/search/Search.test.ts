import { describe, expect, it } from 'vitest';
import { extractPlainText, extractSnippet } from './Search';

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

  it('extracts centered snippet around matched query', () => {
    const fullText =
      '这是一段很长很长的文本，我们在中间讨论了关于分布式事务和一致性不变量的核心设计，后面还有很多其他相关总结内容。';
    const snippet = extractSnippet(fullText, '一致性不变量', 40);

    expect(snippet).toContain('一致性不变量');
    expect(snippet).toContain('…');
  });

  it('returns clean truncated snippet when query is empty', () => {
    const fullText = '简短文本内容。';
    expect(extractSnippet(fullText, '', 50)).toBe('简短文本内容。');
  });
});
