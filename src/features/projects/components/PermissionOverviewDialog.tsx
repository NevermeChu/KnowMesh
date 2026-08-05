'use client';

import { ShieldCheck, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import type { ProjectMemberRole } from '@/features/projects/Project';

const roles: { id: ProjectMemberRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'editor', label: 'Editor' },
  { id: 'viewer', label: 'Viewer' },
];

/**
 * Displays a read-only permission overview for the selected navigation resource.
 *
 * @param props - Loading state, resolved permissions, and close behavior.
 * @returns The permission dialog.
 */
export function PermissionOverviewDialog(props: {
  error: string | null;
  isLoading: boolean;
  overview: PermissionOverview | null;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭权限列表"
        className="fixed inset-0 z-80 cursor-default bg-black/25"
        onClick={props.onClose}
      />
      <dialog
        open
        aria-labelledby="permission-overview-title"
        className="fixed top-1/2 left-1/2 z-90 m-0 flex max-h-[min(80vh,44rem)] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-0 text-[#2f3437] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-black/8 px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#2383e2]/10 text-[#2383e2]">
            <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="permission-overview-title" className="truncate text-base font-semibold">
              {props.overview?.title ?? '权限列表'}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#777b80]">
              {props.overview?.description ?? '正在读取成员权限…'}
            </p>
          </span>
          <button
            type="button"
            aria-label="关闭权限列表"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[#777b80] transition-colors hover:bg-black/5 hover:text-[#202124]"
            onClick={props.onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {props.isLoading && (
            <p className="py-10 text-center text-sm text-[#8a8d91]">正在加载完整权限列表…</p>
          )}
          {!props.isLoading && props.error && (
            <p className="rounded-lg bg-[#d14343]/8 px-3 py-2 text-sm text-[#b52e2e]" role="alert">
              {props.error}
            </p>
          )}
          {!props.isLoading && props.overview?.groups.length === 0 && (
            <p className="py-10 text-center text-sm text-[#8a8d91]">该分区暂无项目和成员权限</p>
          )}
          {!props.isLoading &&
            props.overview?.groups.map((group) => (
              <section key={group.id} className="mb-5 last:mb-0">
                <h3 className="mb-2 text-sm font-semibold text-[#202124]">{group.name}</h3>
                <div className="space-y-3 rounded-lg border border-black/8 p-3">
                  {roles.map((role) => {
                    const members = group.members.filter((member) => member.role === role.id);

                    return (
                      <div key={role.id}>
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold tracking-[0.06em] text-[#8a8d91] uppercase">
                          <span>{role.label}</span>
                          <span>{members.length}</span>
                        </div>
                        {members.length === 0 ? (
                          <p className="rounded-md bg-black/2 px-2.5 py-2 text-xs text-[#a0a3a7]">
                            暂无成员
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {members.map((member) => (
                              <li
                                key={member.userId}
                                className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 ${
                                  member.isCurrentUser
                                    ? 'border-[#2383e2]/30 bg-[#2383e2]/8'
                                    : 'border-transparent bg-black/2'
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e4e7ea] text-xs font-semibold text-[#555a60]"
                                >
                                  {member.displayName.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-[#202124]">
                                      {member.displayName}
                                    </span>
                                    {member.isCurrentUser && (
                                      <span className="shrink-0 rounded-full bg-[#2383e2] px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                                        你
                                      </span>
                                    )}
                                  </span>
                                  {member.email && member.email !== member.displayName && (
                                    <span className="block truncate text-xs text-[#8a8d91]">
                                      {member.email}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      </dialog>
    </>,
    document.body,
  );
}
