'use client';

import type { LucideIcon } from 'lucide-react';
import { Home, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { openCommandPalette } from '@/components/layout/ShellEvents';

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const primaryNavigation: NavigationItem[] = [
  { href: '/dashboard', icon: Home, label: '首页' },
  { href: '/search', icon: Search, label: '搜索' },
  { href: '/starred', icon: Star, label: '收藏' },
];

const isActiveRoute = (pathname: string, href: string) =>
  href === '/dashboard' ? pathname === href : pathname.startsWith(href);

/**
 * Displays primary application navigation.
 *
 * @param props - Current route and navigation behavior.
 * @returns The primary navigation links.
 */
export function SidebarPrimaryNavigation(props: { pathname: string; onNavigate: () => void }) {
  return (
    <nav aria-label="主要导航">
      <ul className="space-y-1">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(props.pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-9 items-center gap-3 rounded-lg px-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-overlay hover:text-ink'
                }`}
                onClick={(event) => {
                  if (item.href === '/search') {
                    event.preventDefault();
                    openCommandPalette();
                  }
                  props.onNavigate();
                }}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.href === '/search' && (
                  <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-faint lg:inline-block">
                    ⌘K
                  </kbd>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
