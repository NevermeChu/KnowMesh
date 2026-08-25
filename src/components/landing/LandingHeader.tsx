import Link from 'next/link';
import { AppLogo } from '@/components/ui/AppLogo';
import { SignOutButton } from '@/features/auth/components/SignOutButton';
import { ThemeToggle } from '@/features/preferences/components/ThemeToggle';

const landingNavigation = [
  { href: '#hero-workspace', label: '工作区体验' },
  { href: '#knowledge-mesh', label: '拓扑网格' },
  { href: '#dual-workspace', label: '双轨与权限' },
  { href: '#editor-search', label: '块级引擎与搜索' },
  { href: '#tech-stack', label: '技术底座' },
] as const;

/**
 * Renders the public landing navigation without adding a layout wrapper.
 *
 * @param props - Current authentication state.
 * @returns The landing navigation.
 */
export function LandingHeader(props: { currentUserId: string | null }) {
  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="landing-container flex h-17 items-center justify-between">
        {/* Brand Logo */}
        <Link className="flex items-center gap-3 text-ink no-underline" href="/">
          <AppLogo className="size-11 rounded-xl shadow-card" />
          <div>
            <span className="text-lg font-bold tracking-[-0.03em] text-ink">KnowMesh</span>
            <span className="ml-[0.35rem] rounded-[0.35rem] bg-accent-soft px-[0.4rem] py-[0.15rem] text-xs font-semibold text-accent">
              知序
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <nav aria-label="首页导航" className="hidden items-center gap-8 md:flex">
          {landingNavigation.map((item) => (
            <a
              className="text-sm font-medium text-ink-secondary no-underline transition-colors"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Actions & Theme Toggle */}
        <div className="flex items-center gap-3">
          <ThemeToggle
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-ink-secondary transition-all hover:bg-surface-strong hover:text-ink"
            iconClassName="size-4.5 text-ink-secondary dark:text-accent"
            strokeWidth={2}
            title="切换外观主题（浅空知序 / 深空知序）"
          />
          {props.currentUserId ? (
            <>
              <Link href="/dashboard" className="btn-primary px-[1.125rem] py-2 text-sm">
                进入工作台
              </Link>
              <SignOutButton
                className="btn-secondary px-4 py-2 text-sm"
                userId={props.currentUserId}
              >
                退出登录
              </SignOutButton>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="btn-secondary px-4 py-2 text-sm">
                登录
              </Link>
              <Link href="/sign-up" className="btn-primary px-[1.125rem] py-2 text-sm">
                免费注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
