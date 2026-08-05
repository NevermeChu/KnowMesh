'use client';

import { createPortal } from 'react-dom';
import { PopupMenu, PopupMenuLabel, popupMenuItemClassName } from './PopupMenu';

export type ContextMenuItem = {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  separatorBefore?: boolean;
};

/**
 * Keeps a context menu within the current viewport.
 *
 * @param options - Pointer position and rendered item count.
 * @returns The adjusted viewport position.
 */
export function fitContextMenuPosition(options: { itemCount: number; x: number; y: number }) {
  const menuWidth = 224;
  const estimatedHeight = 40 + options.itemCount * 36;

  return {
    x: Math.max(8, Math.min(options.x, window.innerWidth - menuWidth - 8)),
    y: Math.max(8, Math.min(options.y, window.innerHeight - estimatedHeight - 8)),
  };
}

/**
 * Renders a cursor-positioned menu and blocks the browser menu within its overlay.
 *
 * @param props - Menu content, position, and close behavior.
 * @returns The context menu when open.
 */
export function ContextMenu(props: {
  id: string;
  items: ContextMenuItem[];
  label: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
}) {
  if (!props.position || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭右键菜单"
        className="fixed inset-0 z-60 cursor-default"
        onClick={props.onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onClose();
        }}
      />
      <PopupMenu
        id={props.id}
        isOpen
        label={props.label}
        placement={{ kind: 'viewport', x: props.position.x, y: props.position.y }}
      >
        <PopupMenuLabel>{props.label}</PopupMenuLabel>
        {props.items.map((item) => (
          <div key={item.label} className="contents">
            {item.separatorBefore && (
              <div aria-hidden="true" className="my-1 border-t border-black/8" />
            )}
            <button
              type="button"
              aria-pressed={item.active}
              className={`${popupMenuItemClassName} ${item.active ? 'bg-black/8 text-[#202124]' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                props.onClose();
                item.onSelect();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </PopupMenu>
    </>,
    document.body,
  );
}
