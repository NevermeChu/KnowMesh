'use client';

import { Check, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { popupMenuItemClassName, PopupMenu, PopupMenuLabel } from '@/components/ui/PopupMenu';
import { DocumentEditorToolbar } from '@/features/documents/components/DocumentEditorToolbar';
import type { DocumentNavigationItem } from '@/features/documents/Document';
import { contentWidthPercentages } from '@/features/preferences/Preferences';
import type { ContentWidthPercentage } from '@/features/preferences/Preferences';
import { updateContentWidth } from '@/features/preferences/server/UpdateContentWidth';
import type { Project } from '@/features/projects/Project';
import { createContentBreadcrumbs } from './ContentBreadcrumbs';

/**
 * Renders shared content navigation and view actions.
 *
 * @param props - Navigation metadata, persisted width, and content fullscreen behavior.
 * @returns The shared content toolbar.
 */
export function ContentToolbar(props: {
  contentWidth: ContentWidthPercentage;
  documents: DocumentNavigationItem[];
  isContentFullscreen: boolean;
  projects: Project[];
  onToggleContentFullscreen: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(props.contentWidth);
  const [isWidthMenuOpen, setIsWidthMenuOpen] = useState(false);
  const [, startTransition] = useTransition();
  const breadcrumbs = createContentBreadcrumbs({
    documentId: searchParams.get('document') ?? undefined,
    documents: props.documents,
    pathname,
    projectId: searchParams.get('project') ?? undefined,
    projects: props.projects,
  });
  const FullscreenIcon = props.isContentFullscreen ? Minimize2 : Maximize2;
  const fullscreenLabel = props.isContentFullscreen ? '退出内容全屏' : '内容全屏';

  function selectContentWidth(nextWidth: ContentWidthPercentage) {
    const previousWidth = width;

    setIsWidthMenuOpen(false);

    if (nextWidth === previousWidth) {
      return;
    }

    setWidth(nextWidth);
    document.documentElement.style.setProperty('--content-read-width', `${nextWidth}%`);
    startTransition(async () => {
      try {
        await updateContentWidth({ width: nextWidth });
      } catch {
        setWidth(previousWidth);
        document.documentElement.style.setProperty('--content-read-width', `${previousWidth}%`);
      }
    });
  }

  return (
    <header className="sticky top-16 z-30 flex h-12 items-center gap-4 border-b border-line bg-card/95 px-4 backdrop-blur-sm lg:top-0">
      <nav aria-label="面包屑" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
          {breadcrumbs.map((breadcrumb, index) => (
            <li key={`${breadcrumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-ink-faint"
                  strokeWidth={1.8}
                />
              )}
              {breadcrumb.href ? (
                <Link href={breadcrumb.href} className="truncate transition-colors hover:text-ink">
                  {breadcrumb.label}
                </Link>
              ) : (
                <span
                  className={`truncate ${index === breadcrumbs.length - 1 ? 'font-medium text-ink' : ''}`}
                >
                  {breadcrumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <DocumentEditorToolbar />

      <div className="relative flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-controls="content-width-menu"
          aria-expanded={isWidthMenuOpen}
          aria-haspopup="dialog"
          aria-label={`内容宽度 ${width}%`}
          title="内容宽度"
          className="hidden h-8 min-w-11 place-items-center rounded-lg px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-overlay hover:text-ink lg:grid"
          onClick={() => {
            setIsWidthMenuOpen((isOpen) => !isOpen);
          }}
        >
          {width}%
        </button>
        <PopupMenu
          id="content-width-menu"
          isOpen={isWidthMenuOpen}
          label="内容宽度"
          placement={{ kind: 'anchor', side: 'bottom' }}
          surfaceClassName="right-0 left-auto w-36 p-1"
        >
          <PopupMenuLabel>内容宽度</PopupMenuLabel>
          {contentWidthPercentages.map((percentage) => (
            <button
              key={percentage}
              type="button"
              className={popupMenuItemClassName}
              onClick={() => {
                selectContentWidth(percentage);
              }}
            >
              <span className="flex-1">{percentage}%</span>
              {percentage === width && (
                <Check aria-hidden="true" className="size-3.5 text-accent" strokeWidth={1.8} />
              )}
            </button>
          ))}
        </PopupMenu>
        <button
          type="button"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          className="hidden size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-overlay hover:text-ink lg:grid"
          onClick={props.onToggleContentFullscreen}
        >
          <FullscreenIcon aria-hidden="true" className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
