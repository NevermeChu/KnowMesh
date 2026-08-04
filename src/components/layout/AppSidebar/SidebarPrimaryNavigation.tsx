'use client';

import type { LucideIcon } from 'lucide-react';
import { Home, Search, Star } from 'lucide-react';
import Link from 'next/link';

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
                    ? 'bg-black/7 text-[#202124]'
                    : 'text-[#666a70] hover:bg-black/5 hover:text-[#202124]'
                }`}
                onClick={props.onNavigate}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
