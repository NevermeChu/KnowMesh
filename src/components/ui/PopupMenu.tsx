'use client';

export const popupMenuItemClassName =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-ink-secondary transition-colors hover:bg-overlay hover:text-ink disabled:cursor-not-allowed disabled:opacity-45';

type PopupMenuPlacement =
  | { kind: 'anchor'; side: 'bottom' | 'top' }
  | { kind: 'viewport'; x: number; y: number };

/**
 * Renders the shared surface used by anchored and context menus.
 *
 * @param props - Menu identity, content, state, and placement.
 * @returns The menu surface when open.
 */
export function PopupMenu(props: {
  children: React.ReactNode;
  id: string;
  isOpen: boolean;
  label: string;
  placement: PopupMenuPlacement;
  surfaceClassName?: string;
}) {
  if (!props.isOpen) {
    return null;
  }

  const viewportPosition =
    props.placement.kind === 'viewport'
      ? { left: props.placement.x, top: props.placement.y }
      : undefined;
  let anchorPositionClassName = '';

  if (props.placement.kind === 'anchor') {
    anchorPositionClassName = props.placement.side === 'bottom' ? 'top-11' : 'bottom-10';
  }

  return (
    <dialog
      open
      id={props.id}
      aria-label={props.label}
      className={`${viewportPosition ? 'fixed z-70' : 'absolute left-1.5 z-20'} m-0 max-w-[calc(100vw-0.75rem)] rounded-xl border border-line bg-card/95 text-ink shadow-overlay backdrop-blur ${props.surfaceClassName ?? 'w-56 p-1'} ${anchorPositionClassName}`}
      style={viewportPosition}
    >
      {props.children}
    </dialog>
  );
}

/**
 * Renders the compact heading shared by popup menus.
 *
 * @param props - Heading text.
 * @returns The menu heading.
 */
export function PopupMenuLabel(props: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-1 pb-0.5 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
      {props.children}
    </p>
  );
}
