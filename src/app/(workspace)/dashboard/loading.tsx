import { WorkspaceContent } from '@/components/layout/WorkspaceContent';

export default function DashboardLoading() {
  return (
    <WorkspaceContent className="animate-pulse py-8 sm:py-12">
      <div className="border-b border-line-soft pb-6">
        <div className="h-8 w-40 rounded-lg bg-surface-strong" />
        <div className="mt-2 h-4 w-72 rounded bg-surface" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`dashboard-skeleton-action-${index}`}
            className="flex items-start gap-3.5 rounded-xl border border-line bg-card p-3.5 shadow-card"
          >
            <div className="size-9 shrink-0 rounded-lg bg-surface-strong" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-20 rounded bg-surface-strong" />
              <div className="h-3 w-32 rounded bg-surface" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-5 w-24 rounded bg-surface-strong" />
          <div className="mt-3 h-64 rounded-xl border border-line bg-card p-4 shadow-card" />
        </div>
        <div className="space-y-6">
          <div>
            <div className="h-5 w-16 rounded bg-surface-strong" />
            <div className="mt-3 h-32 rounded-xl border border-line bg-card p-4 shadow-card" />
          </div>
          <div>
            <div className="h-5 w-24 rounded bg-surface-strong" />
            <div className="mt-3 h-32 rounded-xl border border-line bg-card p-4 shadow-card" />
          </div>
        </div>
      </div>
    </WorkspaceContent>
  );
}
