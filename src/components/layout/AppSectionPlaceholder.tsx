import { WorkspaceContent } from '@/components/layout/WorkspaceContent';

/**
 * Renders guidance when a workspace section has no active project.
 *
 * @param props - Section labels and description.
 * @returns The workspace section empty state.
 */
export function AppSectionPlaceholder(props: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <WorkspaceContent className="py-12 sm:py-16">
      <p className="text-sm font-semibold text-accent">{props.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-ink">{props.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">{props.description}</p>
    </WorkspaceContent>
  );
}
