import Link from 'next/link';
import { SignOutButton } from '@/features/auth/components/SignOutButton';
import { ThemeToggle } from '@/features/preferences/components/ThemeToggle';

/**
 * Renders the public landing navigation without adding a layout wrapper.
 *
 * @param props - Current authentication state.
 * @returns The landing navigation.
 */
export function LandingHeader(props: { isAuthenticated: boolean }) {
  return (
    <header className="glass-nav sticky top-0 z-50">
      <div
        className="landing-container"
        style={{
          display: 'flex',
          height: '4.25rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textDecoration: 'none',
            color: 'var(--ink)',
          }}
        >
          <div
            style={{
              width: '2.25rem',
              height: '2.25rem',
              background: 'var(--ink)',
              borderRadius: '0.625rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--canvas)',
              fontWeight: 800,
              fontSize: '1.125rem',
              letterSpacing: '-0.05em',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            KM
          </div>
          <div>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
              }}
            >
              KnowMesh
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginLeft: '0.35rem',
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                padding: '0.15rem 0.4rem',
                borderRadius: '0.35rem',
              }}
            >
              知序
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <nav
          aria-label="首页导航"
          className="hidden md:flex"
          style={{ alignItems: 'center', gap: '2rem' }}
        >
          <a
            href="#hero-workspace"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--ink-secondary)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            工作区体验
          </a>
          <a
            href="#knowledge-mesh"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--ink-secondary)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            拓扑网格
          </a>
          <a
            href="#dual-workspace"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--ink-secondary)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            双轨与权限
          </a>
          <a
            href="#editor-search"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--ink-secondary)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            块级引擎与搜索
          </a>
          <a
            href="#tech-stack"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--ink-secondary)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            技术底座
          </a>
        </nav>

        {/* Actions & Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-ink-secondary transition-all hover:bg-surface-strong hover:text-ink"
            iconClassName="size-4.5 text-ink-secondary dark:text-accent"
            strokeWidth={2}
            title="切换外观主题（浅空知序 / 深空知序）"
          />
          {props.isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="btn-primary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1.125rem' }}
              >
                进入工作台
              </Link>
              <SignOutButton
                className="btn-secondary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                退出登录
              </SignOutButton>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="btn-secondary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                登录
              </Link>
              <Link
                href="/sign-up"
                className="btn-primary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1.125rem' }}
              >
                免费注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
