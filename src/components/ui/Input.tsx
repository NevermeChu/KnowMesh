/**
 * Renders a standardized text input control with consistent typography,
 * border focus rings, dark mode adaptation, and error states.
 *
 * @param props - Input attributes, value, validation status, and change handler.
 * @returns The styled input element.
 */
export function Input(props: {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  maxLength?: number;
  minLength?: number;
  name?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value?: string;
}) {
  const errorClass = props.hasError
    ? 'border-danger focus:border-danger focus:ring-danger/15'
    : 'border-line focus:border-accent focus:ring-accent/15';

  return (
    <input
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid'] ?? (props.hasError ? true : undefined)}
      aria-label={props['aria-label']}
      autoComplete={props.autoComplete}
      autoFocus={props.autoFocus}
      className={`h-9 w-full rounded-lg border bg-card px-3 text-sm transition-colors outline-none placeholder:text-ink-faint-strong focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45 ${errorClass} ${props.className ?? ''}`}
      defaultValue={props.defaultValue}
      disabled={props.disabled}
      id={props.id}
      maxLength={props.maxLength}
      minLength={props.minLength}
      name={props.name}
      onChange={props.onChange}
      onKeyDown={props.onKeyDown}
      placeholder={props.placeholder}
      required={props.required}
      type={props.type ?? 'text'}
      value={props.value}
    />
  );
}
