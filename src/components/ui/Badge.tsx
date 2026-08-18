export type BadgeVariant = 'accent' | 'danger' | 'neutral' | 'purple' | 'success' | 'warning';
export type BadgeSize = 'md' | 'sm';

const badgeVariantClassNames: Record<BadgeVariant, string> = {
  accent: 'bg-accent-soft text-accent',
  danger: 'bg-danger/10 text-danger-strong',
  neutral: 'bg-overlay text-ink-muted',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const badgeDotVariantClassNames: Record<BadgeVariant, string> = {
  accent: 'bg-accent',
  danger: 'bg-danger',
  neutral: 'bg-ink-muted',
  purple: 'bg-purple-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

const badgeSizeClassNames: Record<BadgeSize, string> = {
  md: 'rounded-full px-2.5 py-0.5 text-xs font-medium gap-1.5',
  sm: 'rounded-md px-1.5 py-0.5 text-[11px] font-medium gap-1',
};

/**
 * Renders a compact badge chip for roles, scopes, and counts.
 *
 * @param props - Badge content, semantic color variant, size, and dot indicator.
 * @returns The styled badge span.
 */
export function Badge(props: {
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
  size?: BadgeSize;
  variant?: BadgeVariant;
}) {
  const variant = props.variant ?? 'neutral';
  const size = props.size ?? 'sm';
  const variantClass = badgeVariantClassNames[variant];
  const sizeClass = badgeSizeClassNames[size];

  return (
    <span
      className={`inline-flex items-center ${sizeClass} ${variantClass} ${props.className ?? ''}`}
    >
      {props.dot && (
        <span
          aria-hidden="true"
          className={`size-1.5 shrink-0 rounded-full ${badgeDotVariantClassNames[variant]}`}
        />
      )}
      {props.children}
    </span>
  );
}
