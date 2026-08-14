import { AppConfig } from '@/utils/AppConfig';

/**
 * Renders route-specific copy around a Clerk authentication card.
 *
 * @param props - Authentication copy and Clerk card content.
 * @returns The authentication panel.
 */
export function AuthenticationPanel(props: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex min-h-0 w-full max-w-md flex-col gap-4">
      <header className="shrink-0">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#202124]">{props.title}</h1>
        <p className="mt-2 text-sm text-[#777b80]">{props.description}</p>
      </header>
      <div className="min-h-0 w-full">{props.children}</div>
      <p className="shrink-0 text-center text-xs text-[#8a8d91]">
        © {new Date().getFullYear()} {AppConfig.name} · 让知识持续创造价值。
      </p>
    </div>
  );
}
