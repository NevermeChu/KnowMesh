import { WorkspaceContent } from '@/components/layout/WorkspaceContent';

export default function WorkspaceLoading() {
  return (
    <WorkspaceContent className="animate-pulse py-8 sm:py-12">
      <div className="border-b border-line-soft pb-6">
        <div className="h-7 w-36 rounded-lg bg-surface-strong" />
        <div className="mt-2 h-4 w-64 rounded bg-surface" />
      </div>

      <div className="mt-8 space-y-4">
        <div className="h-16 w-full rounded-xl border border-line bg-card shadow-card" />
        <div className="h-28 w-full rounded-xl border border-line bg-card shadow-card" />
        <div className="h-44 w-full rounded-xl border border-line bg-card shadow-card" />
      </div>
    </WorkspaceContent>
  );
}
