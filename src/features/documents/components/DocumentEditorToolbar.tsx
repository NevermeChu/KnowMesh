'use client';

import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Bold, Heading2, Italic, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

type DocumentEditorToolbarContextValue = {
  editor: Editor | null;
  registerEditor: (editor: Editor) => void;
  unregisterEditor: (editor: Editor) => void;
};

const DocumentEditorToolbarContext = createContext<DocumentEditorToolbarContextValue | null>(null);

export function DocumentEditorToolbarProvider(props: { children: React.ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <DocumentEditorToolbarContext
      value={{
        editor,
        registerEditor: setEditor,
        unregisterEditor: (removedEditor) => {
          setEditor((currentEditor) => (currentEditor === removedEditor ? null : currentEditor));
        },
      }}
    >
      {props.children}
    </DocumentEditorToolbarContext>
  );
}

export function useDocumentEditorToolbarRegistration() {
  const context = useContext(DocumentEditorToolbarContext);

  if (!context) {
    throw new Error('Document editor toolbar provider is missing');
  }

  return context;
}

function ToolbarButton(props: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      title={props.label}
      className={`grid size-8 shrink-0 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        props.active
          ? 'bg-black/8 text-[#202124]'
          : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
      }`}
      onClick={props.onSelect}
    >
      {props.icon}
    </button>
  );
}

export type DocumentEditorCommand = {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  separatorBefore?: boolean;
};

/**
 * Returns the commands shared by the content toolbar and editor context menu.
 *
 * @returns The active editor commands, or null when no editable editor is registered.
 */
export function useDocumentEditorCommands() {
  const context = useContext(DocumentEditorToolbarContext);
  const editor = context?.editor ?? null;
  const activeState = useEditorState({
    editor,
    selector: (selection) => ({
      blockquote: selection.editor?.isActive('blockquote') ?? false,
      bold: selection.editor?.isActive('bold') ?? false,
      bulletList: selection.editor?.isActive('bulletList') ?? false,
      heading: selection.editor?.isActive('heading', { level: 2 }) ?? false,
      italic: selection.editor?.isActive('italic') ?? false,
      orderedList: selection.editor?.isActive('orderedList') ?? false,
      redo: selection.editor?.can().chain().redo().run() ?? false,
      undo: selection.editor?.can().chain().undo().run() ?? false,
    }),
  });

  if (!editor?.isEditable || !activeState) {
    return null;
  }

  return [
    {
      active: activeState.bold,
      icon: <Bold aria-hidden="true" className="size-4" />,
      label: '粗体',
      onSelect: () => editor.chain().focus().toggleBold().run(),
    },
    {
      active: activeState.italic,
      icon: <Italic aria-hidden="true" className="size-4" />,
      label: '斜体',
      onSelect: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      active: activeState.heading,
      icon: <Heading2 aria-hidden="true" className="size-4" />,
      label: '二级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      active: activeState.bulletList,
      icon: <List aria-hidden="true" className="size-4" />,
      label: '无序列表',
      onSelect: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      active: activeState.orderedList,
      icon: <ListOrdered aria-hidden="true" className="size-4" />,
      label: '有序列表',
      onSelect: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      active: activeState.blockquote,
      icon: <Quote aria-hidden="true" className="size-4" />,
      label: '引用',
      onSelect: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      disabled: !activeState.undo,
      icon: <Undo2 aria-hidden="true" className="size-4" />,
      label: '撤销',
      onSelect: () => editor.chain().focus().undo().run(),
      separatorBefore: true,
    },
    {
      disabled: !activeState.redo,
      icon: <Redo2 aria-hidden="true" className="size-4" />,
      label: '重做',
      onSelect: () => editor.chain().focus().redo().run(),
    },
  ] satisfies DocumentEditorCommand[];
}

export function DocumentEditorToolbar() {
  const commands = useDocumentEditorCommands();

  if (!commands) {
    return null;
  }

  return (
    <div aria-label="文档格式" className="flex shrink-0 items-center gap-0.5" role="toolbar">
      {commands.map((command) => (
        <div key={command.label} className="contents">
          {command.separatorBefore && (
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-black/8" />
          )}
          <ToolbarButton
            active={command.active}
            disabled={command.disabled}
            icon={command.icon}
            label={command.label}
            onSelect={command.onSelect}
          />
        </div>
      ))}
    </div>
  );
}
