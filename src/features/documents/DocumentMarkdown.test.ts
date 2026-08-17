import { describe, expect, it } from 'vitest';
import type { DocumentContent } from './Document';
import { proseMirrorToMarkdown } from './DocumentMarkdown';

describe(proseMirrorToMarkdown, () => {
  it('converts title and basic paragraphs correctly', () => {
    const content: DocumentContent = {
      content: [
        {
          content: [{ text: '这是第一段内容。', type: 'text' }],
          type: 'paragraph',
        },
      ],
      type: 'doc',
    };

    const result = proseMirrorToMarkdown(content, '文档测试标题');
    expect(result.trim()).toBe('# 文档测试标题\n\n这是第一段内容。');
  });

  it('converts formatted text with bold, italic, code and link marks', () => {
    const content: DocumentContent = {
      content: [
        {
          content: [
            { marks: [{ type: 'bold' }], text: '粗体', type: 'text' },
            { text: ' 和 ', type: 'text' },
            { marks: [{ type: 'italic' }], text: '斜体', type: 'text' },
            { text: ' 以及 ', type: 'text' },
            { marks: [{ type: 'code' }], text: 'const x = 1;', type: 'text' },
            { text: ' 与 ', type: 'text' },
            {
              marks: [{ attrs: { href: 'https://example.com' }, type: 'link' }],
              text: '链接',
              type: 'text',
            },
          ],
          type: 'paragraph',
        },
      ],
      type: 'doc',
    };

    const result = proseMirrorToMarkdown(content);
    expect(result.trim()).toBe(
      '**粗体** 和 *斜体* 以及 `const x = 1;` 与 [链接](https://example.com)',
    );
  });

  it('converts bullet list, ordered list and task list correctly', () => {
    const content: DocumentContent = {
      content: [
        {
          content: [
            {
              content: [{ content: [{ text: '无序项 1', type: 'text' }], type: 'paragraph' }],
              type: 'listItem',
            },
            {
              content: [{ content: [{ text: '无序项 2', type: 'text' }], type: 'paragraph' }],
              type: 'listItem',
            },
          ],
          type: 'bulletList',
        },
        {
          content: [
            {
              attrs: { checked: false },
              content: [{ content: [{ text: '待办项 1', type: 'text' }], type: 'paragraph' }],
              type: 'taskItem',
            },
            {
              attrs: { checked: true },
              content: [{ content: [{ text: '已完成项 2', type: 'text' }], type: 'paragraph' }],
              type: 'taskItem',
            },
          ],
          type: 'taskList',
        },
      ],
      type: 'doc',
    };

    const result = proseMirrorToMarkdown(content);
    expect(result).toContain('- 无序项 1\n- 无序项 2');
    expect(result).toContain('- [ ] 待办项 1\n- [x] 已完成项 2');
  });

  it('converts callouts, blockquotes, and code blocks correctly', () => {
    const content: DocumentContent = {
      content: [
        {
          attrs: { type: 'warning' },
          content: [{ content: [{ text: '请注意重要信息', type: 'text' }], type: 'paragraph' }],
          type: 'callout',
        },
        {
          attrs: { language: 'typescript' },
          content: [{ text: 'console.log("hello");', type: 'text' }],
          type: 'codeBlock',
        },
      ],
      type: 'doc',
    };

    const result = proseMirrorToMarkdown(content);
    expect(result).toContain('> [!WARNING]\n> 请注意重要信息');
    expect(result).toContain('```typescript\nconsole.log("hello");\n```');
  });
});
