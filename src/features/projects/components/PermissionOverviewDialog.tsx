'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogButton,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import type {
  PermissionOverview,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';
import type { ProjectMemberRole } from '@/features/projects/Project';

const roles: { id: ProjectMemberRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'editor', label: 'Editor' },
  { id: 'viewer', label: 'Viewer' },
];

function PermissionDocumentTitle(props: {
  overview: Extract<PermissionOverview, { scope: 'document' }>;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  return (
    <button
      type="button"
      className="truncate rounded-sm transition-colors hover:text-[#2383e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2383e2]"
      onClick={() => {
        props.onNavigate({ documentId: props.overview.document.id, scope: 'document' });
      }}
    >
      {props.overview.document.title}
    </button>
  );
}

function PermissionProjectTitle(props: {
  overview: Extract<PermissionOverview, { scope: 'document' | 'project' }>;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  return (
    <button
      type="button"
      className="truncate rounded-sm transition-colors hover:text-[#2383e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2383e2]"
      onClick={() => {
        props.onNavigate({ projectId: props.overview.project.id, scope: 'project' });
      }}
    >
      {props.overview.project.name}
    </button>
  );
}

function PermissionOverviewTitle(props: {
  overview: PermissionOverview | null;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  if (!props.overview) {
    return '权限列表';
  }

  if (props.overview.scope === 'workspace') {
    return props.overview.title;
  }

  if (props.overview.scope === 'project') {
    return <PermissionProjectTitle overview={props.overview} onNavigate={props.onNavigate} />;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <PermissionProjectTitle overview={props.overview} onNavigate={props.onNavigate} />
      <span aria-hidden="true" className="shrink-0 text-[#a0a3a7]">
        \
      </span>
      <PermissionDocumentTitle overview={props.overview} onNavigate={props.onNavigate} />
    </span>
  );
}

function PermissionExitConfirmationDialog(props: {
  resourceLabel: '文件' | '项目';
  resourceName: string;
  onClose: () => void;
}) {
  return (
    <ModalDialog
      dismissal={{ ariaLabel: `关闭退出${props.resourceLabel}确认窗口`, onDismiss: props.onClose }}
      surfaceClassName="w-full max-w-96"
      titleId="permission-exit-confirmation-title"
    >
      <ModalDialogHeader
        closeButton={{
          ariaLabel: `关闭退出${props.resourceLabel}确认窗口`,
          onClick: props.onClose,
        }}
        title={`确认退出${props.resourceLabel}？`}
        titleId="permission-exit-confirmation-title"
      />
      <ModalDialogBody>
        <p className="text-sm leading-6 text-[#666a70]">
          退出后，你将无法继续访问“{props.resourceName}”。请确认是否继续。
        </p>
      </ModalDialogBody>
      <ModalDialogFooter>
        <ModalDialogButton type="button" onClick={props.onClose}>
          取消
        </ModalDialogButton>
        <ModalDialogButton type="button" variant="danger" onClick={props.onClose}>
          退出{props.resourceLabel}
        </ModalDialogButton>
      </ModalDialogFooter>
    </ModalDialog>
  );
}

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
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  const [isExitConfirmationOpen, setIsExitConfirmationOpen] = useState(false);
  let permissionResource: { label: '文件' | '项目'; name: string } | null = null;

  if (props.overview?.scope === 'document') {
    permissionResource = { label: '文件', name: props.overview.document.title };
  } else if (props.overview?.scope === 'project') {
    permissionResource = { label: '项目', name: props.overview.project.name };
  }

  return (
    <>
      <ModalDialog
        dismissal={{ ariaLabel: '关闭权限列表', onDismiss: props.onClose }}
        surfaceClassName="flex max-h-[min(80vh,44rem)] w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden"
        titleId="permission-overview-title"
      >
        <ModalDialogHeader
          closeButton={{ ariaLabel: '关闭权限列表', onClick: props.onClose }}
          icon={<ShieldCheck aria-hidden="true" className="size-5" strokeWidth={1.8} />}
          title={
            <PermissionOverviewTitle overview={props.overview} onNavigate={props.onNavigate} />
          }
          titleId="permission-overview-title"
        />

        <ModalDialogBody surfaceClassName="min-h-0 overflow-y-auto">
          {props.isLoading && (
            <p className="py-10 text-center text-sm text-[#8a8d91]">正在加载完整权限列表…</p>
          )}
          {!props.isLoading && props.error && (
            <p className="rounded-lg bg-[#d14343]/8 px-3 py-2 text-sm text-[#b52e2e]" role="alert">
              {props.error}
            </p>
          )}
          {!props.isLoading && props.overview?.scope === 'workspace' && (
            <p className="mb-4 text-sm leading-6 text-[#666a70]">{props.overview.description}</p>
          )}
          {!props.isLoading && props.overview?.groups.length === 0 && (
            <p className="py-10 text-center text-sm text-[#8a8d91]">暂无成员权限</p>
          )}
          {!props.isLoading &&
            props.overview?.groups.map((group) => (
              <section key={group.id} className="mb-5 last:mb-0">
                {props.overview?.scope === 'workspace' && (
                  <h3 className="mb-2 text-sm font-semibold text-[#202124]">{group.name}</h3>
                )}
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
        </ModalDialogBody>

        {permissionResource && (
          <ModalDialogFooter>
            <ModalDialogButton type="button" variant="primary">
              申请权限
            </ModalDialogButton>
            <ModalDialogButton
              type="button"
              variant="danger"
              onClick={() => {
                setIsExitConfirmationOpen(true);
              }}
            >
              退出{permissionResource.label}
            </ModalDialogButton>
          </ModalDialogFooter>
        )}
      </ModalDialog>
      {isExitConfirmationOpen && permissionResource && (
        <PermissionExitConfirmationDialog
          resourceLabel={permissionResource.label}
          resourceName={permissionResource.name}
          onClose={() => {
            setIsExitConfirmationOpen(false);
          }}
        />
      )}
    </>
  );
}
