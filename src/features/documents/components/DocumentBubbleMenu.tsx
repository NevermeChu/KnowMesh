'use client';

import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Info,
  Italic,
  Link2,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';

type BubbleButtonProps = {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};

function BubbleButton(props: BubbleButtonProps) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={props.label}
      className={`grid size-7.5 place-items-center rounded-md text-xs transition-colors ${
        props.active
          ? 'bg-accent text-white shadow-xs'
          : 'text-ink-secondary hover:bg-overlay hover:text-ink'
      }`}
      onMouseDown={(event) => {
        event.preventDefault();
        props.onClick();
      }}
    >
      {props.icon}
    </button>
  );
}

/**
 * Renders a floating bubble menu above the active text selection.
 *
 * @param props - The active Tiptap editor and optional link modal opener.
 * @returns The floating bubble formatting toolbar.
 */
export function DocumentBubbleMenu(props: {
  editor: Editor | null;
  onOpenLinkEditor?: (href: string) => void;
}) {
  const selectionInfo = useEditorState({
    editor: props.editor,
    selector: (ctx) => {
      if (
        !ctx.editor ||
        ctx.editor.isDestroyed ||
        !ctx.editor.isEditable ||
        ctx.editor.state.selection.empty
      ) {
        return null;
      }

      try {
        const { from, to } = ctx.editor.state.selection;
        const start = ctx.editor.view.coordsAtPos(from);
        const end = ctx.editor.view.coordsAtPos(to);

        const top = Math.min(start.top, end.top) - 8;
        const left = Math.max(160, Math.min(window.innerWidth - 160, (start.left + end.left) / 2));

        return {
          bold: ctx.editor.isActive('bold'),
          callout: ctx.editor.isActive('callout'),
          code: ctx.editor.isActive('code'),
          h1: ctx.editor.isActive('heading', { level: 1 }),
          h2: ctx.editor.isActive('heading', { level: 2 }),
          h3: ctx.editor.isActive('heading', { level: 3 }),
          italic: ctx.editor.isActive('italic'),
          link: ctx.editor.isActive('link'),
          position: { left, top },
          quote: ctx.editor.isActive('blockquote'),
          strike: ctx.editor.isActive('strike'),
          underline: ctx.editor.isActive('underline'),
        };
      } catch {
        return null;
      }
    },
  });

  if (!selectionInfo || !props.editor) {
    return null;
  }

  const { editor } = props;

  return (
    <div
      role="toolbar"
      aria-label="快捷选区格式"
      className="animate-modal-in fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl border border-line bg-card/95 p-1 shadow-overlay backdrop-blur-md"
      style={{
        left: `${selectionInfo.position.left}px`,
        top: `${selectionInfo.position.top}px`,
      }}
    >
      <BubbleButton
        active={selectionInfo.bold}
        icon={<Bold aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="粗体"
        onClick={() => {
          editor.chain().focus().toggleBold().run();
        }}
      />
      <BubbleButton
        active={selectionInfo.italic}
        icon={<Italic aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="斜体"
        onClick={() => {
          editor.chain().focus().toggleItalic().run();
        }}
      />
      <BubbleButton
        active={selectionInfo.underline}
        icon={<Underline aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="下划线"
        onClick={() => {
          editor.chain().focus().toggleUnderline().run();
        }}
      />
      <BubbleButton
        active={selectionInfo.strike}
        icon={<Strikethrough aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="删除线"
        onClick={() => {
          editor.chain().focus().toggleStrike().run();
        }}
      />
      <BubbleButton
        active={selectionInfo.code}
        icon={<Code aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="行内代码"
        onClick={() => {
          editor.chain().focus().toggleCode().run();
        }}
      />

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />

      <BubbleButton
        active={selectionInfo.h1}
        icon={<Heading1 aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="一级标题"
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        }}
      />
      <BubbleButton
        active={selectionInfo.h2}
        icon={<Heading2 aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="二级标题"
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        }}
      />
      <BubbleButton
        active={selectionInfo.h3}
        icon={<Heading3 aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="三级标题"
        onClick={() => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        }}
      />

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />

      <BubbleButton
        active={selectionInfo.quote}
        icon={<Quote aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="引用"
        onClick={() => {
          editor.chain().focus().toggleBlockquote().run();
        }}
      />
      <BubbleButton
        active={selectionInfo.callout}
        icon={<Info aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="高亮提示框"
        onClick={() => {
          editor.chain().focus().toggleCallout({ type: 'info' }).run();
        }}
      />
      <BubbleButton
        active={selectionInfo.link}
        icon={<Link2 aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        label="添加链接"
        onClick={() => {
          const currentHref = editor.getAttributes('link').href;
          if (props.onOpenLinkEditor) {
            props.onOpenLinkEditor(typeof currentHref === 'string' ? currentHref : 'https://');
          }
        }}
      />
    </div>
  );
}
