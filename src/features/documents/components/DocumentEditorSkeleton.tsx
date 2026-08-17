import { WorkspaceContent } from '@/components/layout/WorkspaceContent';

/**
 * Skeleton placeholder for DocumentEditor while dynamic module is loading.
 *
 * @returns The document editor skeleton element.
 */
export function DocumentEditorSkeleton() {
  return (
    <div className="relative py-8">
      <WorkspaceContent as="article">
        <div className="w-full min-w-0">
          {/* Top metadata skeleton */}
          <div className="flex min-h-6 items-center gap-3">
            <div className="h-4 w-20 animate-pulse rounded bg-surface-strong" />
            <div className="h-4 w-24 animate-pulse rounded bg-surface-strong" />
            <div className="h-6 w-6 animate-pulse rounded-lg bg-surface-strong" />
          </div>

          {/* Title skeleton */}
          <div className="mt-5 h-10 w-3/5 animate-pulse rounded-lg bg-surface-strong" />

          {/* Paragraphs skeleton */}
          <div className="mt-8 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-surface-strong" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-surface-strong" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-surface-strong" />
            <div className="mt-6 h-4 w-full animate-pulse rounded bg-surface-strong" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-strong" />
          </div>
        </div>
      </WorkspaceContent>

      {/* Outline aside skeleton */}
      <aside aria-hidden="true" className="fixed top-20 right-6 z-20 hidden w-56 xl:block">
        <div className="rounded-2xl border border-line/70 bg-card/75 p-3 shadow-card">
          <div className="h-5 w-24 animate-pulse rounded bg-surface-strong" />
          <div className="mt-3 space-y-2">
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-strong" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-surface-strong" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-strong" />
          </div>
        </div>
      </aside>
    </div>
  );
}
