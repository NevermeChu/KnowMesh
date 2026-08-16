/**
 * Renders the shared empty-state presentation with an icon chip, message, and optional action.
 *
 * @param props - Empty-state icon, texts, and optional call-to-action content.
 * @returns The empty-state card.
 */
export function EmptyState(props: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-line bg-card px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface text-ink-muted">
        {props.icon}
      </span>
      <p className="mt-3 text-sm font-medium text-ink-secondary">{props.title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-ink-faint">{props.description}</p>
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}
