'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { ContextMenu, fitContextMenuPosition } from '@/components/ui/ContextMenu';
import type { Document, DocumentContent } from '../Document';
import { documentExtensions } from '../DocumentExtensions';
import { isDocumentContent } from '../DocumentSchema';
import { updateDocument } from '../server/UpdateDocument';
import { DocumentBubbleMenu } from './DocumentBubbleMenu';
import {
  useDocumentEditorCommands,
  useDocumentEditorToolbarRegistration,
} from './DocumentEditorToolbar';
import { DocumentExportMenu } from './DocumentExportMenu';
import { DocumentOutline } from './DocumentOutline';
import { DocumentSaveStatus } from './DocumentSaveStatus';
import { DocumentSlashMenu } from './DocumentSlashMenu';
import { StarDocumentButton } from './StarDocumentButton';

type SaveState = 'error' | 'saved' | 'saving';

function countCharacters(content: DocumentContent | null | undefined): number {
  if (!content || !content.content) {
    return 0;
  }
  let count = 0;
  const traverse = (node: unknown) => {
    if (typeof node === 'object' && node !== null) {
      const n = node as { content?: unknown[]; text?: string };
      if (typeof n.text === 'string') {
        count += n.text.length;
      }
      if (Array.isArray(n.content)) {
        for (const child of n.content) {
          traverse(child);
        }
      }
    }
  };
  traverse(content);
  return count;
}

/**
 * Main rich text document editor with auto-save, outline, slash commands, and bubble toolbar.
 *
 * @param props - Document details and separate title and body write capabilities.
 * @returns The document editor layout.
 */
export function DocumentEditor(props: {
  canEditContent: boolean;
  canEditTitle: boolean;
  document: Document;
}) {
  const router = useRouter();
  const toolbarRegistration = useDocumentEditorToolbarRegistration();
  const editorCommands = useDocumentEditorCommands();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [title, setTitle] = useState(props.document.title);
  const [wordCount, setWordCount] = useState(() => countCharacters(props.document.content));
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);
  const lastSavedContent = useRef(JSON.stringify(props.document.content));
  const lastSavedTitle = useRef(props.document.title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingContent = useRef(false);
  const registeredEditor = useRef<Editor | null>(null);

  async function flushContent() {
    if (!props.canEditContent) {
      return;
    }

    const currentEditor = registeredEditor.current;

    if (!currentEditor || currentEditor.isDestroyed || isSavingContent.current) {
      return;
    }

    const content = currentEditor.getJSON();

    if (!isDocumentContent(content)) {
      setSaveState('error');
      return;
    }

    const serializedContent = JSON.stringify(content);

    if (serializedContent === lastSavedContent.current) {
      setSaveState('saved');
      return;
    }

    isSavingContent.current = true;
    setSaveState('saving');
    let didSave = false;

    try {
      await updateDocument({ content, documentId: props.document.id });
      lastSavedContent.current = serializedContent;
      didSave = true;
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally {
      isSavingContent.current = false;

      if (didSave && registeredEditor.current && !registeredEditor.current.isDestroyed) {
        const nextContent = registeredEditor.current.getJSON();
        if (JSON.stringify(nextContent) !== lastSavedContent.current) {
          saveTimer.current = setTimeout(() => {
            void flushContent();
          }, 0);
        }
      }
    }
  }

  const editor = useEditor({
    content: props.document.content,
    editable: props.canEditContent,
    editorProps: {
      attributes: {
        class: 'min-h-[32rem] px-1 pb-32 pt-4 text-[15px] leading-7 text-ink outline-none',
      },
    },
    extensions: documentExtensions,
    immediatelyRender: false,
    onCreate: ({ editor: createdEditor }) => {
      registeredEditor.current = createdEditor;
      toolbarRegistration.registerEditor(createdEditor);
    },
    onDestroy: () => {
      if (registeredEditor.current) {
        toolbarRegistration.unregisterEditor(registeredEditor.current);
        registeredEditor.current = null;
      }
    },
    onBlur: () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      void flushContent();
    },
    onUpdate: ({ editor: currentEditor }) => {
      setWordCount(currentEditor.state.doc.textContent.length);
      setSaveState('saving');

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        void flushContent();
      }, 700);
    },
  });
  const currentContent = editor?.getJSON();
  const exportContent = isDocumentContent(currentContent) ? currentContent : props.document.content;

  const saveTitle = async () => {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      setTitle(lastSavedTitle.current);
      setSaveState('error');
      return;
    }

    if (normalizedTitle === lastSavedTitle.current) {
      setTitle(normalizedTitle);
      return;
    }

    setTitle(normalizedTitle);
    setSaveState('saving');

    try {
      await updateDocument({ documentId: props.document.id, title: normalizedTitle });
      lastSavedTitle.current = normalizedTitle;
      setSaveState('saved');
      router.refresh();
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="relative py-8">
      <WorkspaceContent
        as="article"
        className={`transition-[padding] duration-200 ease-out ${
          isOutlineExpanded ? 'xl:pr-64 2xl:pr-0' : 'xl:pr-0'
        }`}
      >
        <div className="flex min-h-6 items-center justify-between gap-4 text-xs text-ink-faint">
          <div className="flex items-center gap-2.5">
            <DocumentSaveStatus canEdit={props.canEditContent} state={saveState} />
            <span aria-hidden="true" className="text-line">
              ·
            </span>
            <span className="text-xs font-medium text-ink-faint">
              {wordCount} 字 · 约 {Math.max(1, Math.ceil(wordCount / 300))} 分钟阅读
            </span>
            <span aria-hidden="true" className="text-line">
              ·
            </span>
            <StarDocumentButton
              documentId={props.document.id}
              initialIsStarred={props.document.isStarred}
            />
            <span aria-hidden="true" className="text-line">
              ·
            </span>
            <DocumentExportMenu content={exportContent} title={title} />
          </div>
        </div>

        <input
          aria-label="文档标题"
          className="mt-5 w-full bg-transparent text-4xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-faint-strong disabled:opacity-100"
          disabled={!props.canEditTitle}
          maxLength={200}
          placeholder="无标题"
          value={title}
          onBlur={() => {
            void saveTitle();
          }}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
              editor?.commands.focus('start');
            }
          }}
        />

        <div
          onContextMenu={(event) => {
            if (!editorCommands) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            setContextMenuPosition(
              fitContextMenuPosition({
                itemCount: editorCommands.length,
                x: event.clientX,
                y: event.clientY,
              }),
            );
          }}
        >
          <EditorContent editor={editor} />
        </div>

        {props.canEditContent && (
          <>
            <DocumentBubbleMenu
              editor={editor}
              onOpenLinkEditor={toolbarRegistration.openLinkEditor}
            />
            <DocumentSlashMenu editor={editor} />
          </>
        )}

        <ContextMenu
          id="document-format-context-menu"
          items={editorCommands ?? []}
          label="文档格式"
          position={contextMenuPosition}
          onClose={() => {
            setContextMenuPosition(null);
          }}
        />
      </WorkspaceContent>

      <DocumentOutline
        editor={editor}
        isExpanded={isOutlineExpanded}
        onToggleExpanded={setIsOutlineExpanded}
      />
    </div>
  );
}
