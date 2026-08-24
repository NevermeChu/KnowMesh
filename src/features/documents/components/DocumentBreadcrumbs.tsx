'use client';

import { ChevronRight, FileText, Folder } from 'lucide-react';
import Link from 'next/link';
import type { DocumentBreadcrumbItem } from '../Document';

/**
 * Renders hierarchical breadcrumbs for the current document.
 *
 * @param props - Breadcrumbs list, project name, project link, and current document title.
 * @returns The breadcrumbs navigation element.
 */
export function DocumentBreadcrumbs(props: {
  breadcrumbs?: DocumentBreadcrumbItem[];
  currentTitle: string;
  projectHref?: string;
  projectName?: string;
}) {
  return (
    <nav
      aria-label="文档层级导航"
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-ink-faint"
    >
      {props.projectName && (
        <>
          {props.projectHref ? (
            <Link
              href={props.projectHref}
              className="inline-flex max-w-40 items-center gap-1 truncate font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <Folder aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{props.projectName}</span>
            </Link>
          ) : (
            <span className="inline-flex max-w-40 items-center gap-1 truncate font-medium text-ink-muted">
              <Folder aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{props.projectName}</span>
            </span>
          )}
          <ChevronRight
            aria-hidden="true"
            className="size-3 shrink-0 text-ink-faint-strong"
            strokeWidth={1.8}
          />
        </>
      )}

      {props.breadcrumbs?.map((item) => (
        <div key={item.id} className="flex min-w-0 items-center gap-1.5">
          <Link
            href={item.href}
            className="inline-flex max-w-36 items-center gap-1 truncate text-ink-muted transition-colors hover:text-ink"
          >
            <FileText aria-hidden="true" className="size-3 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{item.title}</span>
          </Link>
          <ChevronRight
            aria-hidden="true"
            className="size-3 shrink-0 text-ink-faint-strong"
            strokeWidth={1.8}
          />
        </div>
      ))}

      <span
        aria-current="page"
        className="inline-flex max-w-52 items-center gap-1 truncate font-medium text-ink"
      >
        <FileText aria-hidden="true" className="size-3 shrink-0 text-accent" strokeWidth={1.8} />
        <span className="truncate">{props.currentTitle || '无标题'}</span>
      </span>
    </nav>
  );
}
