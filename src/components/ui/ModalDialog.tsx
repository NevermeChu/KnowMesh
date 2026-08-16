'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

type ModalDialogDismissal = {
  ariaLabel: string;
  isDisabled?: boolean;
  onDismiss: () => void;
};

type ModalDialogButtonVariant = 'accent' | 'danger' | 'neutral' | 'primary';

const modalDialogButtonVariantClassNames: Record<ModalDialogButtonVariant, string> = {
  accent: 'bg-accent text-white hover:bg-accent-strong',
  danger: 'bg-danger text-white hover:bg-danger-strong',
  neutral: 'text-ink-muted hover:bg-overlay hover:text-ink',
  primary: 'bg-ink text-canvas hover:bg-ink-secondary',
};

/**
 * Renders a shared modal surface with an explicit dismissal policy.
 *
 * @param props - Dialog content, identity, sizing, and optional dismissal behavior.
 * @returns The modal dialog in a document-level portal.
 */
export function ModalDialog(props: {
  children: React.ReactNode;
  dismissal?: ModalDialogDismissal;
  surfaceClassName?: string;
  titleId: string;
}) {
  if (typeof document === 'undefined') {
    return null;
  }

  const backdropClassName = 'absolute inset-0 size-full bg-black/25';

  return createPortal(
    <div className="fixed inset-0 z-80 flex overflow-y-auto p-4">
      {props.dismissal ? (
        <button
          type="button"
          aria-label={props.dismissal.ariaLabel}
          className={`${backdropClassName} cursor-default`}
          disabled={props.dismissal.isDisabled}
          onClick={props.dismissal.onDismiss}
        />
      ) : (
        <div aria-hidden="true" className={backdropClassName} />
      )}
      <dialog
        open
        aria-labelledby={props.titleId}
        aria-modal="true"
        className={`relative z-10 m-auto rounded-lg border border-line bg-card p-0 text-ink shadow-lg ${props.surfaceClassName ?? ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && props.dismissal && !props.dismissal.isDisabled) {
            event.preventDefault();
            props.dismissal.onDismiss();
          }
        }}
      >
        {props.children}
      </dialog>
    </div>,
    document.body,
  );
}

/**
 * Renders the shared heading for modal dialogs.
 *
 * @param props - Heading content and optional close action.
 * @returns The modal heading.
 */
export function ModalDialogHeader(props: {
  closeButton?: {
    ariaLabel: string;
    isDisabled?: boolean;
    onClick: () => void;
  };
  description?: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
  titleId: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-line px-5 py-4">
      {props.icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          {props.icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <h2 id={props.titleId} className="truncate text-base font-semibold text-ink">
          {props.title}
        </h2>
        {props.description && (
          <span className="mt-1 block text-sm leading-5 text-ink-muted">{props.description}</span>
        )}
      </span>
      {props.closeButton && (
        <button
          type="button"
          aria-label={props.closeButton.ariaLabel}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          disabled={props.closeButton.isDisabled}
          onClick={props.closeButton.onClick}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </header>
  );
}

/**
 * Renders the consistently spaced content area of a modal dialog.
 *
 * @param props - Body content and optional layout classes.
 * @returns The modal body.
 */
export function ModalDialogBody(props: { children: React.ReactNode; surfaceClassName?: string }) {
  return <div className={`px-5 py-4 ${props.surfaceClassName ?? ''}`}>{props.children}</div>;
}

/**
 * Renders the shared action area at the bottom of a modal dialog.
 *
 * @param props - Footer actions and their alignment.
 * @returns The modal footer.
 */
export function ModalDialogFooter(props: {
  alignment?: 'between' | 'end';
  children: React.ReactNode;
}) {
  return (
    <footer
      className={`flex shrink-0 items-center gap-2 border-t border-line px-5 py-3 ${props.alignment === 'between' ? 'justify-between' : 'justify-end'}`}
    >
      {props.children}
    </footer>
  );
}

/**
 * Renders a modal action with a consistent semantic color.
 *
 * @param props - Button content, behavior, state, and semantic variant.
 * @returns The modal action button.
 */
export function ModalDialogButton(props: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type: 'button' | 'submit';
  variant?: ModalDialogButtonVariant;
}) {
  return (
    <button
      type={props.type}
      className={`h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${modalDialogButtonVariantClassNames[props.variant ?? 'neutral']}`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
