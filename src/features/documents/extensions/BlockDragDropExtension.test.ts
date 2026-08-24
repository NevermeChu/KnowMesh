import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import type { DocumentContent } from '../Document';
import { documentExtensions } from '../DocumentExtensions';
import { moveBlock } from './BlockDragDropExtension';

const createParagraphEditor = (...texts: string[]) =>
  new Editor({
    content: {
      content: texts.map((text) => ({
        content: [{ text, type: 'text' }],
        type: 'paragraph',
      })),
      type: 'doc',
    },
    extensions: documentExtensions,
  });

const getBlockTexts = (editor: Editor) =>
  (editor.getJSON() as DocumentContent).content?.map((node) => node.content?.[0]?.text);

const getBlockPosition = (editor: Editor, index: number) => {
  let position = 0;
  for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
    position += editor.state.doc.child(currentIndex).nodeSize;
  }
  return position;
};

describe('Block drag and drop', () => {
  it('moves a block downwards past another block', () => {
    const editor = createParagraphEditor('First', 'Second', 'Third');
    const targetPos = getBlockPosition(editor, 2);

    expect(moveBlock({ editor, fromPos: 0, targetPos })).toBeTruthy();
    expect(getBlockTexts(editor)).toStrictEqual(['Second', 'First', 'Third']);

    editor.destroy();
  });

  it('moves a block upwards before another block', () => {
    const editor = createParagraphEditor('First', 'Second', 'Third');

    expect(
      moveBlock({
        editor,
        fromPos: getBlockPosition(editor, 2),
        targetPos: 0,
      }),
    ).toBeTruthy();
    expect(getBlockTexts(editor)).toStrictEqual(['Third', 'First', 'Second']);

    editor.destroy();
  });

  it('rejects moving a block within its own bounds', () => {
    const editor = createParagraphEditor('First', 'Second');

    expect(moveBlock({ editor, fromPos: 0, targetPos: 1 })).toBeFalsy();
    expect(getBlockTexts(editor)).toStrictEqual(['First', 'Second']);

    editor.destroy();
  });

  it('moves complex container blocks atomically', () => {
    const editor = new Editor({
      content: {
        content: [
          {
            attrs: { level: 1 },
            content: [{ text: 'Title', type: 'text' }],
            type: 'heading',
          },
          {
            attrs: { type: 'info' },
            content: [
              {
                content: [{ text: 'Important', type: 'text' }],
                type: 'paragraph',
              },
            ],
            type: 'callout',
          },
          {
            content: [{ text: 'Footer', type: 'text' }],
            type: 'paragraph',
          },
        ],
        type: 'doc',
      },
      extensions: documentExtensions,
    });

    expect(
      moveBlock({
        editor,
        fromPos: getBlockPosition(editor, 1),
        targetPos: 0,
      }),
    ).toBeTruthy();
    expect((editor.getJSON() as DocumentContent).content?.map((node) => node.type)).toStrictEqual([
      'callout',
      'heading',
      'paragraph',
    ]);

    editor.destroy();
  });
});
