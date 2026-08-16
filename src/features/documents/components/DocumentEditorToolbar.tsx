'use client';

import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  ChevronDown,
  Code,
  CornerDownLeft,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { PopupMenu } from '@/components/ui/PopupMenu';
import { DocumentLinkDialog } from './DocumentLinkDialog';

const MAX_PRIMARY_DOCUMENT_COMMANDS = 8;

function isEditorActive(options: {
  attributes?: Record<string, boolean | number | string>;
  editor: Editor | null;
  name: string;
}) {
  if (!options.editor || options.editor.isDestroyed) {
    return false;
  }

  return options.editor.isActive(options.name, options.attributes);
}

function canUndo(editor: Editor | null) {
  return editor && !editor.isDestroyed ? editor.can().chain().undo().run() : false;
}

function canRedo(editor: Editor | null) {
  return editor && !editor.isDestroyed ? editor.can().chain().redo().run() : false;
}

type DocumentEditorToolbarContextValue = {
  editor: Editor | null;
  openLinkEditor: (href: string) => void;
  registerEditor: (editor: Editor) => void;
  unregisterEditor: (editor: Editor) => void;
};

const DocumentEditorToolbarContext = createContext<DocumentEditorToolbarContextValue | null>(null);

export function DocumentEditorToolbarProvider(props: { children: React.ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [linkEditorHref, setLinkEditorHref] = useState<string | null>(null);

  return (
    <>
      <DocumentEditorToolbarContext
        value={{
          editor,
          openLinkEditor: setLinkEditorHref,
          registerEditor: setEditor,
          unregisterEditor: (removedEditor) => {
            setEditor((currentEditor) => (currentEditor === removedEditor ? null : currentEditor));
          },
        }}
      >
        {props.children}
      </DocumentEditorToolbarContext>
      {linkEditorHref !== null && (
        <DocumentLinkDialog
          href={linkEditorHref}
          onClose={() => {
            setLinkEditorHref(null);
          }}
          onRemove={() => {
            if (editor && !editor.isDestroyed) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
            }
            setLinkEditorHref(null);
          }}
          onSave={(href) => {
            if (editor && !editor.isDestroyed) {
              editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
            }
            setLinkEditorHref(null);
          }}
        />
      )}
    </>
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
          ? 'bg-overlay-strong text-ink'
          : 'text-ink-muted hover:bg-overlay hover:text-ink'
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
  toolbar: 'history' | 'overflow' | 'primary';
};

function partitionDocumentEditorCommands(commands: DocumentEditorCommand[]) {
  const primaryCommands = commands.filter((command) => command.toolbar === 'primary');

  return {
    history: commands.filter((command) => command.toolbar === 'history'),
    overflow: [
      ...primaryCommands.slice(MAX_PRIMARY_DOCUMENT_COMMANDS),
      ...commands.filter((command) => command.toolbar === 'overflow'),
    ],
    primary: primaryCommands.slice(0, MAX_PRIMARY_DOCUMENT_COMMANDS),
  };
}

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
      blockquote: isEditorActive({ editor: selection.editor, name: 'blockquote' }),
      bold: isEditorActive({ editor: selection.editor, name: 'bold' }),
      bulletList: isEditorActive({ editor: selection.editor, name: 'bulletList' }),
      code: isEditorActive({ editor: selection.editor, name: 'code' }),
      codeBlock: isEditorActive({ editor: selection.editor, name: 'codeBlock' }),
      heading1: isEditorActive({
        attributes: { level: 1 },
        editor: selection.editor,
        name: 'heading',
      }),
      heading2: isEditorActive({
        attributes: { level: 2 },
        editor: selection.editor,
        name: 'heading',
      }),
      heading3: isEditorActive({
        attributes: { level: 3 },
        editor: selection.editor,
        name: 'heading',
      }),
      heading4: isEditorActive({
        attributes: { level: 4 },
        editor: selection.editor,
        name: 'heading',
      }),
      heading5: isEditorActive({
        attributes: { level: 5 },
        editor: selection.editor,
        name: 'heading',
      }),
      heading6: isEditorActive({
        attributes: { level: 6 },
        editor: selection.editor,
        name: 'heading',
      }),
      italic: isEditorActive({ editor: selection.editor, name: 'italic' }),
      link: isEditorActive({ editor: selection.editor, name: 'link' }),
      orderedList: isEditorActive({ editor: selection.editor, name: 'orderedList' }),
      paragraph: isEditorActive({ editor: selection.editor, name: 'paragraph' }),
      redo: canRedo(selection.editor),
      strike: isEditorActive({ editor: selection.editor, name: 'strike' }),
      underline: isEditorActive({ editor: selection.editor, name: 'underline' }),
      undo: canUndo(selection.editor),
    }),
  });

  if (!context || !editor?.isEditable || !activeState) {
    return null;
  }

  const editLink = () => {
    const currentHref = editor.getAttributes('link').href;

    context.openLinkEditor(typeof currentHref === 'string' ? currentHref : 'https://');
  };

  return [
    {
      active: activeState.bold,
      icon: <Bold aria-hidden="true" className="size-4" />,
      label: '粗体',
      onSelect: () => editor.chain().focus().toggleBold().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.italic,
      icon: <Italic aria-hidden="true" className="size-4" />,
      label: '斜体',
      onSelect: () => editor.chain().focus().toggleItalic().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.underline,
      icon: <Underline aria-hidden="true" className="size-4" />,
      label: '下划线',
      onSelect: () => editor.chain().focus().toggleUnderline().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.strike,
      icon: <Strikethrough aria-hidden="true" className="size-4" />,
      label: '删除线',
      onSelect: () => editor.chain().focus().toggleStrike().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.code,
      icon: <Code aria-hidden="true" className="size-4" />,
      label: '行内代码',
      onSelect: () => editor.chain().focus().toggleCode().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.heading2,
      icon: <Heading2 aria-hidden="true" className="size-4" />,
      label: '二级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      toolbar: 'primary',
    },
    {
      active: activeState.bulletList,
      icon: <List aria-hidden="true" className="size-4" />,
      label: '无序列表',
      onSelect: () => editor.chain().focus().toggleBulletList().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.orderedList,
      icon: <ListOrdered aria-hidden="true" className="size-4" />,
      label: '有序列表',
      onSelect: () => editor.chain().focus().toggleOrderedList().run(),
      toolbar: 'primary',
    },
    {
      active: activeState.paragraph,
      icon: <Pilcrow aria-hidden="true" className="size-4" />,
      label: '正文',
      onSelect: () => editor.chain().focus().setParagraph().run(),
      separatorBefore: true,
      toolbar: 'overflow',
    },
    {
      active: activeState.heading1,
      icon: <Heading1 aria-hidden="true" className="size-4" />,
      label: '一级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.heading3,
      icon: <Heading3 aria-hidden="true" className="size-4" />,
      label: '三级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.heading4,
      icon: <Heading4 aria-hidden="true" className="size-4" />,
      label: '四级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.heading5,
      icon: <Heading5 aria-hidden="true" className="size-4" />,
      label: '五级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 5 }).run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.heading6,
      icon: <Heading6 aria-hidden="true" className="size-4" />,
      label: '六级标题',
      onSelect: () => editor.chain().focus().toggleHeading({ level: 6 }).run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.blockquote,
      icon: <Quote aria-hidden="true" className="size-4" />,
      label: '引用',
      onSelect: () => editor.chain().focus().toggleBlockquote().run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.codeBlock,
      icon: <FileCode aria-hidden="true" className="size-4" />,
      label: '代码块',
      onSelect: () => editor.chain().focus().toggleCodeBlock().run(),
      toolbar: 'overflow',
    },
    {
      icon: <Minus aria-hidden="true" className="size-4" />,
      label: '水平分割线',
      onSelect: () => editor.chain().focus().setHorizontalRule().run(),
      toolbar: 'overflow',
    },
    {
      icon: <CornerDownLeft aria-hidden="true" className="size-4" />,
      label: '段内换行',
      onSelect: () => editor.chain().focus().setHardBreak().run(),
      toolbar: 'overflow',
    },
    {
      active: activeState.link,
      icon: <Link2 aria-hidden="true" className="size-4" />,
      label: activeState.link ? '编辑链接' : '添加链接',
      onSelect: editLink,
      toolbar: 'overflow',
    },
    {
      disabled: !activeState.undo,
      icon: <Undo2 aria-hidden="true" className="size-4" />,
      label: '撤销',
      onSelect: () => editor.chain().focus().undo().run(),
      separatorBefore: true,
      toolbar: 'history',
    },
    {
      disabled: !activeState.redo,
      icon: <Redo2 aria-hidden="true" className="size-4" />,
      label: '重做',
      onSelect: () => editor.chain().focus().redo().run(),
      toolbar: 'history',
    },
  ] satisfies DocumentEditorCommand[];
}

export function DocumentEditorToolbar() {
  const commands = useDocumentEditorCommands();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  if (!commands) {
    return null;
  }

  const toolbarCommands = partitionDocumentEditorCommands(commands);

  return (
    <div aria-label="文档格式" className="flex shrink-0 items-center" role="toolbar">
      <div className="relative flex items-center gap-0.5">
        <button
          type="button"
          aria-controls="document-format-overflow"
          aria-expanded={isOverflowOpen}
          aria-label={isOverflowOpen ? '收起更多格式' : '展开更多格式'}
          title={isOverflowOpen ? '收起更多格式' : '展开更多格式'}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-overlay hover:text-ink"
          onClick={() => {
            setIsOverflowOpen((isOpen) => !isOpen);
          }}
        >
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${isOverflowOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <PopupMenu
          id="document-format-overflow"
          isOpen={isOverflowOpen}
          label="更多文档格式"
          placement={{ kind: 'anchor', side: 'bottom' }}
          surfaceClassName="w-[18.5rem] p-2"
        >
          <div className="grid grid-cols-8 gap-1">
            {toolbarCommands.overflow.map((command) => (
              <ToolbarButton
                key={command.label}
                active={command.active}
                disabled={command.disabled}
                icon={command.icon}
                label={command.label}
                onSelect={command.onSelect}
              />
            ))}
          </div>
        </PopupMenu>
        {toolbarCommands.primary.map((command) => (
          <ToolbarButton
            key={command.label}
            active={command.active}
            disabled={command.disabled}
            icon={command.icon}
            label={command.label}
            onSelect={command.onSelect}
          />
        ))}
      </div>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-overlay-strong" />
      <div className="flex items-center gap-0.5">
        {toolbarCommands.history.map((command) => (
          <ToolbarButton
            key={command.label}
            active={command.active}
            disabled={command.disabled}
            icon={command.icon}
            label={command.label}
            onSelect={command.onSelect}
          />
        ))}
      </div>
    </div>
  );
}
