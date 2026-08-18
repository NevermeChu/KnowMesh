import { AppConfig } from '@/utils/AppConfig';

/**
 * Renders route-specific copy around a KnowMesh authentication form.
 *
 * @param props - Authentication copy and form content.
 * @returns The authentication panel.
 */
export function AuthenticationPanel(props: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex min-h-0 w-full max-w-[28rem] flex-col gap-5">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-line-soft bg-card p-6 shadow-[0_24px_80px_-32px_rgb(15_23_42/0.35)] sm:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-accent to-transparent"
        />
        <header className="mb-7">
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            安全访问
          </p>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.035em] text-ink">
            {props.title}
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-ink-muted">{props.description}</p>
        </header>
        <div className="min-h-0 w-full">{props.children}</div>
      </div>
      <p className="shrink-0 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} {AppConfig.name} · 让知识持续创造价值。
      </p>
    </div>
  );
}
