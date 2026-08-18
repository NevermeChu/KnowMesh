export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-7 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-10 text-base',
};

/**
 * Displays a user avatar image with graceful initials fallback.
 *
 * @param props - User display name, optional image url, size, and custom classes.
 * @returns The user avatar element.
 */
export function Avatar(props: {
  className?: string;
  name: string;
  size?: AvatarSize;
  src?: string | null;
}) {
  const size = props.size ?? 'sm';
  const sizeClassName = avatarSizeClasses[size];
  const initial = props.name.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <span
      aria-label={props.name}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-strong font-semibold text-ink-secondary select-none ${sizeClassName} ${props.className ?? ''}`}
    >
      {props.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- User avatars can be dynamic third-party or Clerk URLs
        <img alt={props.name} className="size-full object-cover" src={props.src} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
