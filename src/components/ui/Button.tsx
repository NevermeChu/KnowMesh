export type ButtonVariant = 'accent' | 'danger' | 'ghost' | 'neutral' | 'primary' | 'secondary';
export type ButtonSize = 'icon' | 'lg' | 'md' | 'sm';

const buttonVariantClassNames: Record<ButtonVariant, string> = {
  accent: 'bg-accent text-white shadow-xs hover:bg-accent-strong',
  danger: 'bg-danger text-white shadow-xs hover:bg-danger-strong',
  ghost: 'text-ink-muted hover:bg-overlay hover:text-ink',
  neutral: 'text-ink-secondary hover:bg-overlay hover:text-ink',
  primary: 'bg-accent text-white shadow-xs hover:bg-accent-strong',
  secondary:
    'border border-line bg-card text-ink-secondary shadow-xs hover:bg-overlay hover:text-ink',
};

const buttonSizeClassNames: Record<ButtonSize, string> = {
  icon: 'grid size-9 shrink-0 place-items-center rounded-lg p-0',
  lg: 'h-10 rounded-lg px-4 text-sm gap-2',
  md: 'h-9 rounded-lg px-3.5 text-sm gap-2',
  sm: 'h-8 rounded-md px-2.5 text-xs gap-1.5',
};

/**
 * Renders an interactive button with semantic color variants and sizes.
 *
 * @param props - Button content, styling variant, size, and event handlers.
 * @returns The styled HTML button element.
 */
export function Button(props: {
  'aria-label'?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  size?: ButtonSize;
  title?: string;
  type?: 'button' | 'reset' | 'submit';
  variant?: ButtonVariant;
}) {
  const variant = props.variant ?? 'neutral';
  const size = props.size ?? 'md';
  const variantClass = buttonVariantClassNames[variant];
  const sizeClass = buttonSizeClassNames[size];

  return (
    <button
      aria-label={props['aria-label']}
      className={`inline-flex cursor-pointer items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${sizeClass} ${variantClass} ${props.className ?? ''}`}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      type={props.type ?? 'button'}
    >
      {props.icon && <span className="shrink-0">{props.icon}</span>}
      {props.children}
    </button>
  );
}
