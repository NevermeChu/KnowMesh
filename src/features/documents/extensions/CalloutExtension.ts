import { mergeAttributes, Node } from '@tiptap/core';

export type CalloutType = 'info' | 'note' | 'success' | 'warning';

declare module '@tiptap/core' {
  // eslint-disable-next-line typescript/consistent-type-definitions
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

/**
 * Tiptap custom node extension for rendering styled callout boxes.
 */
export const Callout = Node.create({
  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (element) => element.dataset.calloutType ?? 'info',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-callout-type': typeof attributes.type === 'string' ? attributes.type : 'info',
        }),
      },
    };
  },

  addCommands() {
    return {
      setCallout:
        (attributes?: { type?: CalloutType }) =>
        ({ commands }) =>
          commands.setNode(this.name, attributes),
      toggleCallout:
        (attributes?: { type?: CalloutType }) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attributes),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  content: 'block*',
  defining: true,
  group: 'block',
  name: 'callout',

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          class: 'callout-block',
          'data-type': 'callout',
        },
        HTMLAttributes,
      ),
      ['div', { class: 'callout-content' }, 0],
    ];
  },
});
