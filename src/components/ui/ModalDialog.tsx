'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ButtonVariant } from './Button';
import { Button } from './Button';

type ModalDialogDismissal = {
  ariaLabel: string;
  isDisabled?: boolean;
  onDismiss: () => void;
};

export type ModalDialogButtonVariant = ButtonVariant;

/**
 * Renders a shared modal surface with a frosted backdrop, entrance motion, and
 * an explicit dismissal policy.
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

  const backdropClassName =
    'animate-overlay-in absolute inset-0 size-full bg-black/45 backdrop-blur-[2px]';

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
        className={`animate-modal-in relative z-10 m-auto rounded-xl border border-line bg-card p-0 text-ink shadow-overlay ${props.surfaceClassName ?? ''}`}
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
 * Renders the shared heading for modal dialogs with an identity chip, a large
 * title, and an optional muted description.
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
    <header className="flex items-start gap-3 px-6 pt-5 pb-2">
      <span className="min-w-0 flex-1">
        <h2
          id={props.titleId}
          className="flex min-w-0 items-center gap-2.5 text-lg font-semibold tracking-tight text-ink"
        >
          {props.icon && (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              {props.icon}
            </span>
          )}
          <span className="truncate">{props.title}</span>
        </h2>
        {props.description && (
          <span className="mt-1.5 block text-sm leading-6 text-ink-muted">{props.description}</span>
        )}
      </span>
      {props.closeButton && (
        <button
          type="button"
          aria-label={props.closeButton.ariaLabel}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-overlay hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
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
  return <div className={`px-6 py-5 ${props.surfaceClassName ?? ''}`}>{props.children}</div>;
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
      className={`flex shrink-0 items-center gap-2 border-t border-line px-6 py-4 ${props.alignment === 'between' ? 'justify-between' : 'justify-end'}`}
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
    <Button
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type}
      variant={props.variant}
    >
      {props.children}
    </Button>
  );
}
