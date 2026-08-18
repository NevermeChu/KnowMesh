function FormFieldMessage(props: {
  error?: React.ReactNode;
  hint?: React.ReactNode;
  reserveErrorSpace?: boolean;
}) {
  if (props.error) {
    return (
      <p className="min-h-4 text-xs text-danger" role="alert">
        {props.error}
      </p>
    );
  }

  if (props.hint) {
    return <p className="text-xs text-ink-faint">{props.hint}</p>;
  }

  if (props.reserveErrorSpace ?? true) {
    return <p aria-hidden="true" className="min-h-4 text-xs" />;
  }

  return null;
}

/**
 * Encapsulates a form field with a label, input container, validation error,
 * and optional hint message with stable layout height.
 *
 * @param props - Label, field control, validation error, and hint text.
 * @returns The form field wrapper.
 */
export function FormField(props: {
  children: React.ReactNode;
  className?: string;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  label?: React.ReactNode;
  required?: boolean;
  reserveErrorSpace?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${props.className ?? ''}`}>
      {props.label && (
        <label className="block text-xs font-medium text-ink-secondary" htmlFor={props.htmlFor}>
          {props.label}
          {props.required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}

      {props.children}

      <FormFieldMessage
        error={props.error}
        hint={props.hint}
        reserveErrorSpace={props.reserveErrorSpace}
      />
    </div>
  );
}
