'use client';

import { ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DocumentEditorToolbar } from '@/features/documents/components/DocumentEditorToolbar';

type BreadcrumbItem = {
  href?: string;
  label: string;
};

const routeLabels: Record<string, string> = {
  collaboration: '协作区',
  dashboard: '首页',
  personal: '个人工作区',
  preferences: '系统偏好设置',
  search: '搜索',
  settings: '设置',
  starred: '收藏',
  'user-profile': '账号设置',
};

const navigableBreadcrumbs = new Set(['/collaboration', '/dashboard', '/personal']);

const createBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean);
  let currentPath = '';

  return segments.map((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    return {
      href: !isLast && navigableBreadcrumbs.has(currentPath) ? currentPath : undefined,
      label: routeLabels[segment] ?? segment.replaceAll('-', ' '),
    };
  });
};

/**
 * Renders shared content navigation and view actions.
 *
 * @param props - Content fullscreen state and toggle behavior.
 * @returns The shared content toolbar.
 */
export function ContentToolbar(props: {
  isContentFullscreen: boolean;
  onToggleContentFullscreen: () => void;
}) {
  const pathname = usePathname();
  const breadcrumbs = createBreadcrumbs(pathname);
  const FullscreenIcon = props.isContentFullscreen ? Minimize2 : Maximize2;
  const fullscreenLabel = props.isContentFullscreen ? '退出内容全屏' : '内容全屏';

  return (
    <header className="sticky top-16 z-30 flex h-12 items-center gap-4 border-b border-black/8 bg-white/95 px-4 backdrop-blur-sm lg:top-0">
      <nav aria-label="面包屑" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-[#777b80]">
          {breadcrumbs.map((breadcrumb, index) => (
            <li key={`${breadcrumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-[#a5a8ac]"
                  strokeWidth={1.8}
                />
              )}
              {breadcrumb.href ? (
                <Link
                  href={breadcrumb.href}
                  className="truncate transition-colors hover:text-[#202124]"
                >
                  {breadcrumb.label}
                </Link>
              ) : (
                <span
                  className={`truncate ${index === breadcrumbs.length - 1 ? 'font-medium text-[#2f3437]' : ''}`}
                >
                  {breadcrumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <DocumentEditorToolbar />

      <button
        type="button"
        aria-label={fullscreenLabel}
        title={fullscreenLabel}
        className="hidden size-8 shrink-0 place-items-center rounded-lg text-[#666a70] transition-colors hover:bg-black/5 hover:text-[#202124] lg:grid"
        onClick={props.onToggleContentFullscreen}
      >
        <FullscreenIcon aria-hidden="true" className="size-4" strokeWidth={1.8} />
      </button>
    </header>
  );
}
