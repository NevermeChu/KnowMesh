'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import { StarterKit } from '@tiptap/starter-kit';
import type * as Y from 'yjs';
import { getDocumentCollaborationColor } from '../collaboration/DocumentCollaborationPresence';
import { DOCUMENT_COLLABORATION_FIELD } from '../collaboration/DocumentCollaborationTransform';
import { documentNodeExtensions } from '../DocumentExtensions';

export function getCollaborativeDocumentExtensions(options: {
  document: Y.Doc;
  provider: HocuspocusProvider;
}) {
  return [
    StarterKit.configure({ undoRedo: false }),
    ...documentNodeExtensions,
    Collaboration.configure({
      document: options.document,
      field: DOCUMENT_COLLABORATION_FIELD,
    }),
    CollaborationCaret.configure({
      provider: options.provider,
      user: {},
      render(user) {
        const color = getDocumentCollaborationColor(
          typeof user.id === 'string' ? user.id : 'pending-user',
        );
        const caret = document.createElement('span');
        caret.classList.add('relative', 'border-l-2', 'border-solid', 'pointer-events-none');
        caret.style.borderColor = color;

        const label = document.createElement('span');
        label.classList.add(
          'absolute',
          '-left-0.5',
          '-top-6',
          'rounded-sm',
          'px-1.5',
          'py-0.5',
          'text-[10px]',
          'font-medium',
          'text-white',
          'whitespace-nowrap',
        );
        label.style.backgroundColor = color;
        label.textContent = typeof user.name === 'string' ? user.name : '协作者';
        caret.append(label);
        return caret;
      },
      selectionRender(user) {
        const color = getDocumentCollaborationColor(
          typeof user.id === 'string' ? user.id : 'pending-user',
        );
        return {
          class: 'collaboration-selection',
          style: `background-color: color-mix(in srgb, ${color} 24%, transparent)`,
        };
      },
    }),
  ];
}
