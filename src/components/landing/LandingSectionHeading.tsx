/**
 * Renders the centered heading shared by landing-page feature sections.
 *
 * @param props - Section copy and visual variants.
 * @returns The shared landing section heading.
 */
export function LandingSectionHeading(props: {
  description: string;
  eyebrow: string;
  softBadge?: boolean;
  spacious?: boolean;
  title: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto text-center ${props.spacious ? 'mb-14' : 'mb-12'} ${
        props.wide ? 'max-w-[780px]' : 'max-w-[680px]'
      }`}
    >
      <span className={`badge-pill mb-3 text-accent ${props.softBadge ? 'bg-accent-soft' : ''}`}>
        {props.eyebrow}
      </span>
      <h2 className="text-[2.25rem] font-extrabold tracking-[-0.03em] text-ink">{props.title}</h2>
      <p className="mt-3 text-base text-ink-muted">{props.description}</p>
    </div>
  );
}
