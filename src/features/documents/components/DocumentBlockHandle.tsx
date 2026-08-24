'use client';

import { NodeSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { GripVertical, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DocumentBlockMenu } from './DocumentBlockMenu';

type HandleState = {
  blockPos: number;
  left: number;
  top: number;
};

/**
 * Floating block handle for Notion-style block drag & drop, quick addition, and contextual block action menu.
 *
 * @param props - Active Tiptap editor instance.
 * @returns The floating block handle element.
 */
export function DocumentBlockHandle(props: { editor: Editor | null }) {
  const [handleState, setHandleState] = useState<HandleState | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const currentBlockPosRef = useRef<number | null>(null);
  const ghostElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { editor } = props;
    let cleanup: (() => void) | undefined;

    if (!editor || editor.isDestroyed || !editor.isEditable) {
      setHandleState(null);
      setIsMenuOpen(false);
    } else {
      const editorDom = editor.view.dom;

      const handleMouseMove = (event: MouseEvent) => {
        if (editor.isDestroyed || !editor.isEditable) {
          return;
        }

        // If block menu is open or hovering directly over the floating handle, maintain current position
        if (
          isMenuOpen ||
          (event.target instanceof Node && handleRef.current?.contains(event.target))
        ) {
          return;
        }

        const editorRect = editorDom.getBoundingClientRect();
        // Allow gutter hover within 64px to the left of the editor
        if (
          event.clientX < editorRect.left - 64 ||
          event.clientX > editorRect.right ||
          event.clientY < editorRect.top ||
          event.clientY > editorRect.bottom
        ) {
          return;
        }

        // Clamp X coordinate to inside the editor text area for accurate block detection
        const sampleX = Math.max(
          editorRect.left + 16,
          Math.min(editorRect.right - 16, event.clientX),
        );
        const posInfo = editor.view.posAtCoords({ left: sampleX, top: event.clientY });
        if (!posInfo) {
          return;
        }

        const $pos = editor.state.doc.resolve(posInfo.pos);
        if ($pos.depth < 1) {
          return;
        }

        // Find top-level block position (depth = 1)
        const blockPos = $pos.before(1);
        const dom = editor.view.nodeDOM(blockPos);
        if (!(dom instanceof HTMLElement)) {
          return;
        }

        const blockRect = dom.getBoundingClientRect();
        // Align handle vertically with the top line of the block
        const top = blockRect.top + Math.min(4, Math.max(0, (blockRect.height - 24) / 2));
        const left = Math.max(8, blockRect.left - 52);

        currentBlockPosRef.current = blockPos;
        setHandleState({
          blockPos,
          left,
          top,
        });
      };

      const handleMouseLeave = (event: MouseEvent) => {
        // Don't hide if moving directly onto the handle or if menu is open
        if (
          isMenuOpen ||
          (event.relatedTarget instanceof Node && handleRef.current?.contains(event.relatedTarget))
        ) {
          return;
        }
        setHandleState(null);
        currentBlockPosRef.current = null;
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsMenuOpen(false);
        }
        if (!isMenuOpen) {
          setHandleState(null);
          currentBlockPosRef.current = null;
        }
      };

      const handleScroll = () => {
        if (!isMenuOpen) {
          setHandleState(null);
          currentBlockPosRef.current = null;
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      editorDom.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('keydown', handleKeyDown);

      cleanup = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        editorDom.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return cleanup;
  }, [props.editor, isMenuOpen]);

  if (!handleState || !props.editor || props.editor.isDestroyed || !props.editor.isEditable) {
    return null;
  }

  const { editor } = props;

  const handleAddBlockBelow = () => {
    const blockPos = currentBlockPosRef.current;
    if (blockPos === null || editor.isDestroyed) {
      return;
    }

    const $pos = editor.state.doc.resolve(blockPos);
    const node = $pos.nodeAfter;
    const insertPos = node ? blockPos + node.nodeSize : blockPos;

    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: 'paragraph' })
      .setTextSelection(insertPos + 1)
      .run();
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    setIsMenuOpen(false);
    const blockPos = currentBlockPosRef.current;
    if (blockPos === null || editor.isDestroyed) {
      return;
    }

    const { state, view } = editor;
    const $pos = state.doc.resolve(blockPos);
    const node = $pos.nodeAfter;
    if (!node) {
      return;
    }

    // Create a NodeSelection for the block
    const selection = NodeSelection.create(state.doc, blockPos);
    view.dispatch(state.tr.setSelection(selection));

    // Register with ProseMirror view dragging context
    view.dragging = {
      move: true,
      slice: selection.content(),
    };

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.textContent);

      // Create a clean drag preview ghost pill
      const ghost = document.createElement('div');
      ghost.className =
        'fixed -left-[9999px] top-0 flex items-center gap-1.5 rounded-lg border border-line bg-card/95 px-3 py-1.5 text-xs font-medium text-ink shadow-overlay backdrop-blur-md';
      const textPreview =
        node.textContent.trim().slice(0, 32) ||
        (node.type.name === 'paragraph' ? '空白段落' : node.type.name);
      ghost.textContent = `⠿ ${textPreview}`;
      document.body.append(ghost);
      ghostElementRef.current = ghost;

      event.dataTransfer.setDragImage(ghost, 16, 16);
    }
  };

  const handleDragEnd = () => {
    if (ghostElementRef.current) {
      ghostElementRef.current.remove();
      ghostElementRef.current = null;
    }
    if (editor.view && editor.view.dragging) {
      editor.view.dragging = null;
    }
  };

  return (
    <>
      <div
        ref={handleRef}
        aria-label="块级操作手柄"
        className="animate-fade-in fixed z-30 flex items-center gap-0.5 rounded-lg border border-line bg-card/90 p-0.5 text-ink-faint shadow-xs backdrop-blur-xs transition-opacity duration-150 hover:text-ink"
        style={{
          left: `${handleState.left}px`,
          top: `${handleState.top}px`,
        }}
      >
        <button
          type="button"
          aria-label="在下方插入块"
          title="在下方插入块"
          className="grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-overlay hover:text-ink"
          onClick={handleAddBlockBelow}
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>

        <button
          type="button"
          draggable
          aria-label="点击打开块菜单，按住拖拽移动"
          title="点击打开块菜单，按住拖拽移动"
          data-block-pos={handleState.blockPos}
          className="grid size-6 cursor-grab place-items-center rounded-md text-ink-faint transition-colors hover:bg-overlay hover:text-ink active:cursor-grabbing"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <GripVertical aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      {isMenuOpen && currentBlockPosRef.current !== null && (
        <DocumentBlockMenu
          blockPos={currentBlockPosRef.current}
          editor={editor}
          position={{
            left: handleState.left + 56,
            top: handleState.top,
          }}
          onClose={() => {
            setIsMenuOpen(false);
          }}
        />
      )}
    </>
  );
}
