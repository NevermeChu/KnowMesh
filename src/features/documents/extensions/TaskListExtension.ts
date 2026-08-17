import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  // eslint-disable-next-line typescript/consistent-type-definitions
  interface Commands<ReturnType> {
    taskList: {
      toggleTaskList: () => ReturnType;
    };
  }
}

/**
 * Single interactive task/checklist item with checkbox state.
 */
export const TaskItem = Node.create({
  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => {
          const { dataset } = element;
          if (dataset.checked !== undefined) {
            return dataset.checked === 'true';
          }
          const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
          return checkbox ? checkbox.checked : false;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-checked': attributes.checked ? 'true' : 'false',
        }),
      },
    };
  },

  addNodeView() {
    return ({ editor, getPos, node }) => {
      const dom = document.createElement('li');
      dom.dataset.type = 'taskItem';
      dom.dataset.checked = node.attrs.checked ? 'true' : 'false';

      const label = document.createElement('label');
      label.contentEditable = 'false';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(node.attrs.checked);

      checkbox.addEventListener('change', (event) => {
        if (!editor.isEditable) {
          checkbox.checked = !checkbox.checked;
          return;
        }

        if (event.target instanceof HTMLInputElement) {
          const { checked } = event.target;

          if (typeof getPos === 'function') {
            const position = getPos();
            if (typeof position === 'number') {
              editor
                .chain()
                .focus(undefined, { scrollIntoView: false })
                .command(({ tr }) => {
                  tr.setNodeAttribute(position, 'checked', checked);
                  return true;
                })
                .run();
            }
          }
        }
      });

      label.append(checkbox);
      dom.append(label);

      const contentDOM = document.createElement('div');
      dom.append(contentDOM);

      return {
        contentDOM,
        dom,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }
          dom.dataset.checked = updatedNode.attrs.checked ? 'true' : 'false';
          checkbox.checked = Boolean(updatedNode.attrs.checked);
          return true;
        },
      };
    };
  },

  content: 'paragraph block*',
  defining: true,
  name: 'taskItem',

  parseHTML() {
    return [
      {
        priority: 51,
        tag: 'li[data-type="taskItem"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes({ 'data-type': 'taskItem' }, HTMLAttributes),
      [
        'label',
        { contenteditable: 'false' },
        [
          'input',
          {
            checked: HTMLAttributes['data-checked'] === 'true' ? 'checked' : undefined,
            type: 'checkbox',
          },
        ],
      ],
      ['div', 0],
    ];
  },
});

/**
 * Container list for task items with toggle command and keyboard shortcut support.
 */
export const TaskList = Node.create({
  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ commands }) =>
          commands.toggleList(this.name, 'taskItem'),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),
    };
  },

  content: 'taskItem+',
  group: 'block list',
  name: 'taskList',

  parseHTML() {
    return [
      {
        priority: 51,
        tag: 'ul[data-type="taskList"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes({ 'data-type': 'taskList' }, HTMLAttributes), 0];
  },
});
