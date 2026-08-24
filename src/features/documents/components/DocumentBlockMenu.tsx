'use client';

import type { Editor } from '@tiptap/react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ChevronDownSquare,
  ChevronRight,
  Copy,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { moveBlock } from '../extensions/BlockDragDropExtension';
import type { CalloutType } from '../extensions/CalloutExtension';

export type BlockTransformType =
  | 'bulletList'
  | 'callout'
  | 'codeBlock'
  | 'details'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'orderedList'
  | 'paragraph'
  | 'quote'
  | 'taskList';

const transformOptions: {
  icon: React.ReactNode;
  label: string;
  type: BlockTransformType;
}[] = [
  { icon: <Pilcrow aria-hidden="true" className="size-3.5" />, label: '正文', type: 'paragraph' },
  { icon: <Heading1 aria-hidden="true" className="size-3.5" />, label: '一级标题', type: 'h1' },
  { icon: <Heading2 aria-hidden="true" className="size-3.5" />, label: '二级标题', type: 'h2' },
  { icon: <Heading3 aria-hidden="true" className="size-3.5" />, label: '三级标题', type: 'h3' },
  {
    icon: <List aria-hidden="true" className="size-3.5" />,
    label: '无序列表',
    type: 'bulletList',
  },
  {
    icon: <ListOrdered aria-hidden="true" className="size-3.5" />,
    label: '有序列表',
    type: 'orderedList',
  },
  {
    icon: <CheckSquare aria-hidden="true" className="size-3.5" />,
    label: '任务列表',
    type: 'taskList',
  },
  { icon: <Quote aria-hidden="true" className="size-3.5" />, label: '引用', type: 'quote' },
  {
    icon: <FileCode aria-hidden="true" className="size-3.5" />,
    label: '代码块',
    type: 'codeBlock',
  },
  {
    icon: <Info aria-hidden="true" className="size-3.5 text-accent" />,
    label: '信息提示框',
    type: 'callout',
  },
  {
    icon: <ChevronDownSquare aria-hidden="true" className="size-3.5" />,
    label: '折叠列表',
    type: 'details',
  },
];

/**
 * Notion-style block contextual action menu (Delete, Duplicate, Transform, Move Up/Down).
 *
 * @param props - Editor, block position, position coordinates, and close handler.
 * @returns Block contextual menu modal overlay.
 */
export function DocumentBlockMenu(props: {
  blockPos: number;
  editor: Editor;
  position: { left: number; top: number };
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<'main' | 'transform'>('main');
  const { blockPos, editor, position, onClose } = props;

  if (typeof document === 'undefined' || editor.isDestroyed || !editor.isEditable) {
    return null;
  }

  const $pos = editor.state.doc.resolve(blockPos);
  const node = $pos.nodeAfter;
  if (!node) {
    return null;
  }

  const handleDelete = () => {
    onClose();
    editor
      .chain()
      .focus()
      .deleteRange({ from: blockPos, to: blockPos + node.nodeSize })
      .run();
  };

  const handleDuplicate = () => {
    onClose();
    const insertPos = blockPos + node.nodeSize;
    const rawNodeJson: unknown = node.toJSON();
    if (typeof rawNodeJson === 'object' && rawNodeJson !== null) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          insertPos,
          rawNodeJson as Parameters<typeof editor.commands.insertContentAt>[1],
        )
        .run();
    }
  };

  const handleMoveUp = () => {
    onClose();
    const blockIndex = $pos.index(0);
    if (blockIndex > 0) {
      const prevBlockPos = $pos.posAtIndex(blockIndex - 1, 0);
      moveBlock({
        editor,
        fromPos: blockPos,
        targetPos: prevBlockPos,
      });
    }
  };

  const handleMoveDown = () => {
    onClose();
    const blockIndex = $pos.index(0);
    if (blockIndex < editor.state.doc.childCount - 1) {
      const nextBlock = editor.state.doc.child(blockIndex + 1);
      const nextBlockEnd = blockPos + node.nodeSize + nextBlock.nodeSize;
      moveBlock({
        editor,
        fromPos: blockPos,
        targetPos: nextBlockEnd,
      });
    }
  };

  const handleTransform = (type: BlockTransformType) => {
    onClose();
    // Select the block first
    editor.commands.setTextSelection(blockPos + 1);

    const chain = editor.chain().focus();
    switch (type) {
      case 'paragraph': {
        chain.setParagraph().run();
        break;
      }
      case 'h1': {
        chain.toggleHeading({ level: 1 }).run();
        break;
      }
      case 'h2': {
        chain.toggleHeading({ level: 2 }).run();
        break;
      }
      case 'h3': {
        chain.toggleHeading({ level: 3 }).run();
        break;
      }
      case 'bulletList': {
        chain.toggleBulletList().run();
        break;
      }
      case 'orderedList': {
        chain.toggleOrderedList().run();
        break;
      }
      case 'taskList': {
        chain.toggleTaskList().run();
        break;
      }
      case 'quote': {
        chain.toggleBlockquote().run();
        break;
      }
      case 'codeBlock': {
        chain.toggleCodeBlock().run();
        break;
      }
      case 'callout': {
        chain.setCallout({ type: 'info' as CalloutType }).run();
        break;
      }
      case 'details': {
        chain.insertDetails().run();
        break;
      }
      default: {
        break;
      }
    }
  };

  // Adjust menu coordinates to stay on screen
  const menuWidth = 200;
  const menuHeight = viewMode === 'transform' ? 320 : 180;
  const adjustedLeft = Math.max(8, Math.min(position.left, window.innerWidth - menuWidth - 8));
  const adjustedTop = Math.max(8, Math.min(position.top, window.innerHeight - menuHeight - 8));

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭块操作菜单"
        className="fixed inset-0 z-60 cursor-default bg-transparent"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        aria-label="块级操作"
        className="animate-modal-in fixed z-70 w-52 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-overlay backdrop-blur-md"
        style={{
          left: `${adjustedLeft}px`,
          top: `${adjustedTop}px`,
        }}
      >
        {viewMode === 'main' ? (
          <div className="flex flex-col gap-0.5 text-xs text-ink-secondary">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-overlay hover:text-ink"
              onClick={() => {
                setViewMode('transform');
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="size-3.5 text-accent" />
                <span>转换为...</span>
              </div>
              <ChevronRight aria-hidden="true" className="size-3.5 text-ink-faint" />
            </button>

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-overlay hover:text-ink"
              onClick={handleDuplicate}
            >
              <Copy aria-hidden="true" className="size-3.5" />
              <span>创建副本</span>
            </button>

            <div className="my-0.5 h-px bg-line" />

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-overlay hover:text-ink"
              onClick={handleMoveUp}
            >
              <ArrowUp aria-hidden="true" className="size-3.5" />
              <span>上移一行</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-overlay hover:text-ink"
              onClick={handleMoveDown}
            >
              <ArrowDown aria-hidden="true" className="size-3.5" />
              <span>下移一行</span>
            </button>

            <div className="my-0.5 h-px bg-line" />

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-500 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
              onClick={handleDelete}
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
              <span>删除块</span>
            </button>
          </div>
        ) : (
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto text-xs text-ink-secondary">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-ink-faint transition-colors hover:bg-overlay hover:text-ink"
              onClick={() => {
                setViewMode('main');
              }}
            >
              <span>← 返回上一级</span>
            </button>
            <div className="my-0.5 h-px bg-line" />
            {transformOptions.map((opt) => (
              <button
                key={opt.type}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-overlay hover:text-ink"
                onClick={() => {
                  handleTransform(opt.type);
                }}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
