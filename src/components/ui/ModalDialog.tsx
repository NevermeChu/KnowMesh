'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

type ModalDialogDismissal = {
  ariaLabel: string;
  isDisabled?: boolean;
  onDismiss: () => void;
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
        className={`relative z-10 m-auto rounded-lg border border-black/10 bg-white p-0 text-[#2f3437] shadow-lg ${props.surfaceClassName ?? ''}`}
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
    <header className="flex items-start gap-3 border-b border-black/8 px-5 py-4">
      {props.icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#2383e2]/10 text-[#2383e2]">
          {props.icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <h2 id={props.titleId} className="truncate text-base font-semibold text-[#202124]">
          {props.title}
        </h2>
        {props.description && (
          <span className="mt-1 block text-sm leading-5 text-[#777b80]">{props.description}</span>
        )}
      </span>
      {props.closeButton && (
        <button
          type="button"
          aria-label={props.closeButton.ariaLabel}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#777b80] transition-colors hover:bg-black/5 hover:text-[#202124] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={props.closeButton.isDisabled}
          onClick={props.closeButton.onClick}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </header>
  );
}
