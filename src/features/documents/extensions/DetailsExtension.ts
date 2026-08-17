import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  // eslint-disable-next-line typescript/consistent-type-definitions
  interface Commands<ReturnType> {
    details: {
      insertDetails: () => ReturnType;
      unsetDetails: () => ReturnType;
    };
  }
}

/**
 * Summary header for the collapsible details block.
 */
export const DetailsSummary = Node.create({
  content: 'inline*',
  defining: true,
  name: 'detailsSummary',

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * Content container for the collapsible details block.
 */
export const DetailsContent = Node.create({
  content: 'block*',
  defining: true,
  name: 'detailsContent',

  parseHTML() {
    return [{ tag: 'div[data-type="details-content"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ class: 'details-content', 'data-type': 'details-content' }, HTMLAttributes),
      0,
    ];
  },
});

/**
 * Collapsible accordion details block.
 */
export const Details = Node.create({
  addCommands() {
    return {
      insertDetails:
        () =>
        ({ commands }) =>
          commands.insertContent({
            content: [
              {
                content: [{ text: '折叠标题', type: 'text' }],
                type: 'detailsSummary',
              },
              {
                content: [
                  {
                    type: 'paragraph',
                  },
                ],
                type: 'detailsContent',
              },
            ],
            type: this.name,
          }),
      unsetDetails:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  content: 'detailsSummary detailsContent*',
  defining: true,
  group: 'block',
  name: 'details',

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes({ open: 'true' }, HTMLAttributes), 0];
  },
});
