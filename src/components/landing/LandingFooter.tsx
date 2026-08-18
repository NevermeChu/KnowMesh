import { AppLogo } from '@/components/ui/AppLogo';

/**
 * Renders the public landing footer.
 *
 * @returns The landing footer.
 */
export function LandingFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--line)',
        background: 'var(--canvas)',
        padding: '3rem 0',
      }}
    >
      <div
        className="landing-container"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AppLogo className="size-7 rounded-[0.4rem]" />
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>KnowMesh 知序</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
            · 让知识持续创造价值
          </span>
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--ink-faint)' }}>
          © 2026 KnowMesh. Built with Next.js 16, Tailwind v4 & Better Auth.
        </div>
      </div>
    </footer>
  );
}
