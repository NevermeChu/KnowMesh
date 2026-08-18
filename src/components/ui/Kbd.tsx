/**
 * Renders a standardized keyboard key badge for shortcut hints and action accelerators.
 *
 * @param props - Key symbol/label, custom className, and optional variant style.
 * @returns The styled kbd element.
 */
export function Kbd(props: {
  children: React.ReactNode;
  className?: string;
  surface?: 'card' | 'surface';
}) {
  const bgClass = props.surface === 'card' ? 'bg-card' : 'bg-surface';

  return (
    <kbd
      className={`inline-block rounded border border-line px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-faint ${bgClass} ${props.className ?? ''}`}
    >
      {props.children}
    </kbd>
  );
}
