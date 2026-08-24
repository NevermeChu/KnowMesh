import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';

export const BLOCK_DRAG_DROP_PLUGIN_KEY = new PluginKey('blockDragDrop');

export type DropIndicatorInfo = {
  left: number;
  targetPos: number;
  top: number;
  width: number;
};

/**
 * Resolves the source dragged block position from drag tracking state or active selection.
 *
 * @param draggedPos - Explicitly tracked block position from dragstart.
 * @param view - Active ProseMirror EditorView.
 * @returns Source block position if available.
 */
export function getDraggedSourcePos(draggedPos: number | null, view: EditorView): number | null {
  if (draggedPos !== null) {
    return draggedPos;
  }
  if (view.state.selection instanceof NodeSelection) {
    return view.state.selection.from;
  }
  return null;
}

/**
 * Moves a block node from one position to a target position in the document.
 *
 * @param options - Editor instance, source position and target insertion position.
 * @returns True if the block was moved, false otherwise.
 */
export function moveBlock(options: {
  editor: Editor;
  fromPos: number;
  targetPos: number;
}): boolean {
  const { editor, fromPos, targetPos } = options;
  if (!editor || !editor.state || !editor.options.editable) {
    return false;
  }

  if (typeof window !== 'undefined' && editor.isDestroyed) {
    return false;
  }

  const { state, view } = editor;
  const { doc, tr } = state;
  const $pos = doc.resolve(fromPos);
  const node = $pos.nodeAfter;
  if (!node) {
    return false;
  }

  const { nodeSize } = node;
  const fromEnd = fromPos + nodeSize;

  // Dragging to the same position or within the source block bounds is a no-op
  if (targetPos >= fromPos && targetPos <= fromEnd) {
    return false;
  }

  const sliceContent = doc.slice(fromPos, fromEnd).content;

  let finalPos = targetPos;

  if (targetPos > fromEnd) {
    // Target is after source block. Deleting source shifts the target position to the left.
    tr.delete(fromPos, fromEnd);
    finalPos = targetPos - nodeSize;
    tr.insert(finalPos, sliceContent);
  } else {
    // Target is before source block. Deleting source does not shift positions before fromPos.
    tr.delete(fromPos, fromEnd);
    tr.insert(finalPos, sliceContent);
  }

  const insertedNode = tr.doc.resolve(finalPos).nodeAfter;
  if (insertedNode && NodeSelection.isSelectable(insertedNode)) {
    tr.setSelection(NodeSelection.create(tr.doc, finalPos));
  } else {
    const textPos = Math.min(tr.doc.content.size, finalPos + 1);
    const selection = Selection.near(tr.doc.resolve(textPos));
    if (selection) {
      tr.setSelection(selection);
    }
  }

  if (view && typeof view.dispatch === 'function') {
    view.dispatch(tr.scrollIntoView());
  }

  return true;
}

/**
 * Calculates the drop target block and drop line position from mouse coordinates.
 *
 * @param options - Editor instance, client coordinates, and source position being dragged.
 * @returns DropIndicatorInfo if a valid drop target is found, null otherwise.
 */
export function calculateDropTarget(options: {
  clientX: number;
  clientY: number;
  editor: Editor;
  sourcePos: number | null;
}): DropIndicatorInfo | null {
  const { clientX, clientY, editor, sourcePos } = options;
  if (!editor || !editor.state || !editor.options.editable) {
    return null;
  }

  if (typeof window !== 'undefined' && editor.isDestroyed) {
    return null;
  }

  const { state, view } = editor;
  if (!view || typeof view.posAtCoords !== 'function') {
    return null;
  }

  const posInfo = view.posAtCoords({ left: clientX, top: clientY });
  if (!posInfo) {
    return null;
  }

  const $pos = state.doc.resolve(posInfo.pos);
  if ($pos.depth < 1) {
    return null;
  }

  // Find top-level block position (depth = 1)
  const targetBlockPos = $pos.before(1);
  const targetNode = state.doc.resolve(targetBlockPos).nodeAfter;
  if (!targetNode) {
    return null;
  }

  const targetDom = view.nodeDOM(targetBlockPos);
  if (!(targetDom instanceof HTMLElement)) {
    return null;
  }

  const rect = targetDom.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const isAbove = clientY < midY;

  const targetPos = isAbove ? targetBlockPos : targetBlockPos + targetNode.nodeSize;
  const dropTop = isAbove ? rect.top : rect.bottom;

  // Don't show indicator if dropping right before or right after the source block itself
  if (sourcePos !== null) {
    const sourceNode = state.doc.resolve(sourcePos).nodeAfter;
    if (sourceNode) {
      const sourceEnd = sourcePos + sourceNode.nodeSize;
      if (targetPos === sourcePos || targetPos === sourceEnd) {
        return null;
      }
    }
  }

  return {
    left: rect.left,
    targetPos,
    top: dropTop,
    width: rect.width,
  };
}

let activeDropIndicatorElement: HTMLDivElement | null = null;

function showDropIndicator(info: DropIndicatorInfo) {
  if (typeof document === 'undefined') {
    return;
  }

  if (!activeDropIndicatorElement) {
    const el = document.createElement('div');
    el.dataset.blockDropIndicator = 'true';
    el.className =
      'fixed z-50 pointer-events-none h-0.5 bg-accent rounded-full transition-[top,left,width] duration-75 shadow-xs';

    const dot = document.createElement('div');
    dot.className =
      'absolute -left-1.5 -top-1 size-2.5 rounded-full bg-accent ring-2 ring-card shadow-xs';
    el.append(dot);

    document.body.append(el);
    activeDropIndicatorElement = el;
  }

  activeDropIndicatorElement.style.display = 'block';
  activeDropIndicatorElement.style.left = `${info.left}px`;
  activeDropIndicatorElement.style.top = `${info.top - 1}px`;
  activeDropIndicatorElement.style.width = `${info.width}px`;
}

function hideDropIndicator() {
  if (activeDropIndicatorElement) {
    activeDropIndicatorElement.style.display = 'none';
  }
}

/**
 * Tiptap extension that enables Notion-style block drag & drop with boundary snapping
 * and visual drop indicator.
 */
export const BlockDragDropExtension = Extension.create({
  name: 'blockDragDrop',

  addProseMirrorPlugins() {
    let currentDropTarget: DropIndicatorInfo | null = null;
    let draggedSourcePos: number | null = null;

    return [
      new Plugin({
        key: BLOCK_DRAG_DROP_PLUGIN_KEY,
        props: {
          handleDOMEvents: {
            dragstart: (_view, event) => {
              const { target } = event;
              if (target instanceof HTMLElement && target.dataset.blockPos) {
                const pos = Number.parseInt(target.dataset.blockPos, 10);
                if (!Number.isNaN(pos)) {
                  draggedSourcePos = pos;
                }
              }
              return false;
            },
            dragover: (view, event) => {
              if (!this.editor.options.editable) {
                return false;
              }

              // Check if we are currently dragging a block
              if (view.dragging || draggedSourcePos !== null) {
                const sourcePos = getDraggedSourcePos(draggedSourcePos, view);

                const dropInfo = calculateDropTarget({
                  clientX: event.clientX,
                  clientY: event.clientY,
                  editor: this.editor,
                  sourcePos,
                });

                if (dropInfo) {
                  currentDropTarget = dropInfo;
                  showDropIndicator(dropInfo);
                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                  }
                  return true;
                }

                currentDropTarget = null;
                hideDropIndicator();
              }
              return false;
            },
            dragleave: (_view, event) => {
              // Only hide if leaving the window or editor boundary
              if (!event.relatedTarget) {
                currentDropTarget = null;
                hideDropIndicator();
              }
              return false;
            },
            drop: (view, event) => {
              if (currentDropTarget && (view.dragging || draggedSourcePos !== null)) {
                const sourcePos = getDraggedSourcePos(draggedSourcePos, view);

                hideDropIndicator();
                const { targetPos } = currentDropTarget;
                currentDropTarget = null;
                draggedSourcePos = null;

                if (sourcePos !== null) {
                  event.preventDefault();
                  event.stopPropagation();
                  moveBlock({
                    editor: this.editor,
                    fromPos: sourcePos,
                    targetPos,
                  });
                  return true;
                }
              }

              currentDropTarget = null;
              draggedSourcePos = null;
              hideDropIndicator();
              return false;
            },
            dragend: () => {
              currentDropTarget = null;
              draggedSourcePos = null;
              hideDropIndicator();
              return false;
            },
          },
        },
      }),
    ];
  },
});
