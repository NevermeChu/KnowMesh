import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { AuditLogTimeline } from '@/features/audit-logs/components/AuditLogTimeline';
import { getWorkspaceAuditLogs } from '@/features/audit-logs/server/GetWorkspaceAuditLogs';
import { getWorkspaceContext } from '@/features/workspaces/server/GetWorkspaceContext';

export default async function AuditLogsPage() {
  const { activeWorkspace } = await getWorkspaceContext();

  if (!activeWorkspace || activeWorkspace.kind !== 'team' || activeWorkspace.role !== 'owner') {
    return (
      <WorkspaceContent className="py-10 sm:py-14">
        <header className="border-b border-line-soft pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">审计日志</h1>
          <p className="mt-1 text-sm text-ink-muted">查看工作区内关键操作与权限变更记录。</p>
        </header>
        <section className="bg-surface-raised mt-8 flex flex-col items-center justify-center rounded-xl border border-line-soft p-8 text-center sm:p-12">
          <div className="bg-danger-soft flex size-12 items-center justify-center rounded-full text-danger-strong">
            <ShieldAlert className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-ink">无权访问</h2>
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            审计日志属于工作区最高安全资产，仅对团队工作区的唯一所有者（Owner）开放。请切换至你拥有的团队工作区后再试。
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            返回工作台
          </Link>
        </section>
      </WorkspaceContent>
    );
  }

  const items = await getWorkspaceAuditLogs({
    workspaceId: activeWorkspace.id,
  });

  return (
    <WorkspaceContent className="py-10 sm:py-14">
      <header className="border-b border-line-soft pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">审计日志</h1>
          <span className="text-xs text-ink-faint">工作区: {activeWorkspace.name}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          查看团队成员变更、角色权限调整、所有权转让及资源生命周期等不可篡改的操作记录。
        </p>
      </header>

      <section className="mt-8">
        <AuditLogTimeline items={items} />
      </section>
    </WorkspaceContent>
  );
}
