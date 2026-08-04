/**
 * Renders a placeholder section until its feature view is implemented.
 *
 * @param props - Section labels and description.
 * @returns The placeholder section view.
 */
export function AppSectionPlaceholder(props: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl py-12 sm:py-16">
      <p className="text-sm font-semibold text-[#2383e2]">{props.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#202124]">{props.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[#666a70]">{props.description}</p>

      <div className="mt-12 rounded-2xl border border-dashed border-black/12 bg-white/70 px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#777b80]">文档视图将在后续功能中提供</p>
      </div>
    </div>
  );
}
