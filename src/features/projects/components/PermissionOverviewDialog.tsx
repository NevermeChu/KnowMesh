'use client';

/* oxlint-disable eslint/complexity, unicorn/prefer-ternary -- Member management keeps scope-specific actions together for reviewability. */

import { ShieldCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogButton,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import { deleteDocument } from '@/features/documents/server/DeleteDocument';
import { updateDocument } from '@/features/documents/server/UpdateDocument';
import type { MemberRole, Permission } from '@/features/permissions/Permission';
import {
  approveProjectAccessRequest,
  inviteProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
} from '@/features/permissions/server/ProjectMembers';
import {
  inviteWorkspaceMember,
  approveWorkspaceAccessRequest,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  requestWorkspaceEditAccess,
} from '@/features/permissions/server/WorkspaceMembers';
import type {
  PermissionOverview,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';
import {
  canMutatePermissionGroupMembers,
  getPermissionOverviewRemovalMode,
} from '@/features/projects/PermissionOverview';
import { deleteOrLeaveProject } from '@/features/projects/server/DeleteProject';
import { updateProject } from '@/features/projects/server/UpdateProject';
import { deleteOrLeaveWorkspace } from '@/features/workspaces/server/DeleteWorkspace';
import { updateWorkspace } from '@/features/workspaces/server/UpdateWorkspace';

const roles: { id: MemberRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'editor', label: 'Editor' },
  { id: 'viewer', label: 'Viewer' },
];

function PermissionMemberManager(props: {
  overview: PermissionOverview;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
}) {
  const [email, setEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (
    props.overview.scope === 'document' ||
    !props.overview.permissions.includes(
      props.overview.scope === 'workspace' ? 'workspace.members.manage' : 'project.members.manage',
    )
  ) {
    return null;
  }

  const directGroup = props.overview.groups.find((group) => group.source === 'project');
  const directMemberIds = new Set(directGroup?.members.map((member) => member.userId));
  const candidates =
    props.overview.scope === 'project'
      ? props.overview.workspaceMembers.filter((member) => !directMemberIds.has(member.userId))
      : [];

  return (
    <section className="mb-5 rounded-lg border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold text-ink">成员管理</h3>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              if (props.overview.scope === 'workspace') {
                await inviteWorkspaceMember({
                  email,
                  workspaceId: props.overview.workspaceId,
                });
              } else {
                await inviteProjectMember({
                  memberUserId: selectedUserId,
                  projectId: props.overview.project.id,
                });
              }
              props.onMutated('update', props.overview.scope);
            } catch {
              setError(
                props.overview.scope === 'workspace'
                  ? '邀请发送失败，请确认邮箱和邮件配置。'
                  : '项目成员添加失败。',
              );
            }
          });
        }}
      >
        {props.overview.scope === 'workspace' ? (
          <input
            required
            type="email"
            aria-label="受邀成员邮箱"
            placeholder="成员邮箱"
            value={email}
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-card px-3 text-sm outline-none focus:border-accent"
            disabled={isPending}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        ) : (
          <select
            required
            aria-label="工作区成员"
            value={selectedUserId}
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-card px-3 text-sm outline-none focus:border-accent"
            disabled={isPending}
            onChange={(event) => {
              setSelectedUserId(event.target.value);
            }}
          >
            <option value="">选择工作区成员</option>
            {candidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        )}
        <ModalDialogButton type="submit" variant="primary" disabled={isPending}>
          {props.overview.scope === 'workspace' ? '发送邀请' : '邀请成员'}
        </ModalDialogButton>
      </form>
      {error && <p className="mt-2 text-xs text-danger-strong">{error}</p>}
    </section>
  );
}

function WorkspaceAccessRequest(props: {
  overview: Extract<PermissionOverview, { scope: 'workspace' }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [didRequest, setDidRequest] = useState(false);

  if (props.overview.currentUserRole !== 'viewer' || didRequest) {
    return null;
  }

  return (
    <section className="mb-5 rounded-lg border border-line p-3">
      <h3 className="text-sm font-semibold text-ink">工作区编辑权限</h3>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        Viewer 可以浏览工作区结构；创建项目需要申请 Editor 权限。
      </p>
      <ModalDialogButton
        type="button"
        variant="primary"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await requestWorkspaceEditAccess({ workspaceId: props.overview.workspaceId });
            setDidRequest(true);
          });
        }}
      >
        {isPending ? '提交中…' : '申请编辑权限'}
      </ModalDialogButton>
    </section>
  );
}

function ProjectAccessRequests(props: {
  overview: Extract<PermissionOverview, { scope: 'project' }>;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (props.overview.requests.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-lg border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold text-ink">权限申请</h3>
      <ul className="space-y-2">
        {props.overview.requests.map((request) => (
          <li key={request.userId} className="flex items-center gap-3 rounded-md bg-overlay p-2.5">
            <span className="min-w-0 flex-1 text-sm">
              {request.displayName} 申请成为 {request.requestedRole}
            </span>
            <ModalDialogButton
              type="button"
              variant="primary"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await approveProjectAccessRequest({
                    memberUserId: request.userId,
                    projectId: props.overview.project.id,
                  });
                  props.onMutated('update', 'project');
                });
              }}
            >
              批准
            </ModalDialogButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WorkspaceAccessReviews(props: {
  overview: Extract<PermissionOverview, { scope: 'workspace' }>;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (props.overview.requests.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-lg border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold text-ink">权限申请</h3>
      <ul className="space-y-2">
        {props.overview.requests.map((request) => (
          <li key={request.userId} className="flex items-center gap-3 rounded-md bg-overlay p-2.5">
            <span className="min-w-0 flex-1 text-sm">{request.displayName} 申请成为 editor</span>
            <ModalDialogButton
              type="button"
              variant="primary"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await approveWorkspaceAccessRequest({
                    memberUserId: request.userId,
                    workspaceId: props.overview.workspaceId,
                  });
                  props.onMutated('update', 'workspace');
                });
              }}
            >
              批准
            </ModalDialogButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PermissionMemberActions(props: {
  groupSource: PermissionOverview['groups'][number]['source'];
  member: PermissionOverview['groups'][number]['members'][number];
  overview: PermissionOverview;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (
    props.overview.scope === 'document' ||
    !props.overview.permissions.includes(
      props.overview.scope === 'workspace' ? 'workspace.members.manage' : 'project.members.manage',
    ) ||
    !canMutatePermissionGroupMembers({
      scope: props.overview.scope,
      source: props.groupSource,
    }) ||
    props.member.role === 'owner'
  ) {
    return null;
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      {props.member.role === 'editor' && (
        <button
          type="button"
          className="h-8 rounded-md border border-line bg-card px-2 text-xs"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              if (props.overview.scope === 'workspace') {
                await updateWorkspaceMemberRole({
                  memberUserId: props.member.userId,
                  role: 'viewer',
                  workspaceId: props.overview.workspaceId,
                });
              } else {
                await updateProjectMemberRole({
                  memberUserId: props.member.userId,
                  projectId: props.overview.project.id,
                  role: 'viewer',
                });
              }
              props.onMutated('update', props.overview.scope);
            });
          }}
        >
          降为 Viewer
        </button>
      )}
      <button
        type="button"
        aria-label={`移除${props.member.displayName}`}
        className="h-8 rounded-md px-2 text-xs text-danger-strong hover:bg-danger/8"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            if (props.overview.scope === 'workspace') {
              await removeWorkspaceMember({
                memberUserId: props.member.userId,
                workspaceId: props.overview.workspaceId,
              });
            } else {
              await removeProjectMember({
                memberUserId: props.member.userId,
                projectId: props.overview.project.id,
              });
            }
            props.onMutated('update', props.overview.scope);
          });
        }}
      >
        移除
      </button>
    </span>
  );
}

function PermissionDocumentTitle(props: {
  overview: Extract<PermissionOverview, { scope: 'document' }>;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  return (
    <button
      type="button"
      className="truncate rounded-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      className="truncate rounded-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <span aria-hidden="true" className="shrink-0 text-ink-faint">
        \
      </span>
      <PermissionDocumentTitle overview={props.overview} onNavigate={props.onNavigate} />
    </span>
  );
}

function getResourceDetails(overview: PermissionOverview) {
  if (overview.scope === 'workspace') {
    return {
      id: overview.groups[0]?.id ?? '',
      label: '工作区' as const,
      name: overview.groups[0]?.name ?? '',
    };
  }

  if (overview.scope === 'project') {
    return { id: overview.project.id, label: '项目' as const, name: overview.project.name };
  }

  return { id: overview.document.id, label: '文件' as const, name: overview.document.title };
}

function getResourcePermission(options: {
  operation: 'delete' | 'update';
  scope: PermissionOverview['scope'];
}): Permission {
  return `${options.scope}.${options.operation}`;
}

function getDeleteConsequence(scope: PermissionOverview['scope']) {
  if (scope === 'workspace') {
    return '，其中的项目和文件也会一并删除。';
  }

  if (scope === 'project') {
    return '，其中的文件也会一并删除。';
  }

  return '。';
}

function getRemovalDescription(options: {
  overview: PermissionOverview;
  removalMode: 'delete' | 'leave' | null;
  resourceName: string;
}) {
  if (options.removalMode === 'leave') {
    if (options.overview.scope === 'workspace') {
      return `退出“${options.resourceName}”后，你拥有的项目及文件会一并删除；其他人的资源保持不变。`;
    }

    return `退出“${options.resourceName}”后，你将失去访问权限，资源及其他成员不受影响。`;
  }

  return `“${options.resourceName}”删除后无法恢复${getDeleteConsequence(options.overview.scope)}`;
}

function PermissionResourceEditor(props: {
  overview: PermissionOverview;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
}) {
  const resource = getResourceDetails(props.overview);
  const [name, setName] = useState(resource.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canUpdate = props.overview.permissions.includes(
    getResourcePermission({ operation: 'update', scope: props.overview.scope }),
  );

  if (!canUpdate) {
    return null;
  }

  return (
    <section className="mb-5 rounded-lg border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold text-ink">基本信息</h3>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              if (props.overview.scope === 'workspace') {
                await updateWorkspace({ name, workspaceId: resource.id });
              } else if (props.overview.scope === 'project') {
                await updateProject({ name, projectId: resource.id });
              } else {
                await updateDocument({ documentId: resource.id, title: name });
              }
              props.onMutated('update', props.overview.scope);
            } catch {
              setError(`${resource.label}名称保存失败，请稍后重试`);
            }
          });
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{resource.label}名称</span>
          <input
            required
            aria-label={`${resource.label}名称`}
            maxLength={props.overview.scope === 'document' ? 200 : 80}
            value={name}
            className="h-9 w-full rounded-md border border-line bg-card px-3 text-sm outline-none focus:border-accent"
            disabled={isPending}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <ModalDialogButton
          type="submit"
          variant="primary"
          disabled={isPending || name.trim() === resource.name}
        >
          {isPending ? '保存中…' : '保存名称'}
        </ModalDialogButton>
      </form>
      {error && (
        <p className="mt-2 text-xs text-danger-strong" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function PermissionRemovalConfirmationDialog(props: {
  overview: PermissionOverview;
  onClose: () => void;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
}) {
  const resource = getResourceDetails(props.overview);
  const [confirmationName, setConfirmationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const removalMode = getPermissionOverviewRemovalMode(props.overview);
  const actionLabel = removalMode === 'leave' ? '退出' : '删除';

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: `关闭${actionLabel}${resource.label}确认窗口`,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-96"
      titleId="permission-removal-confirmation-title"
    >
      <ModalDialogHeader
        closeButton={{
          ariaLabel: `关闭${actionLabel}${resource.label}确认窗口`,
          onClick: props.onClose,
        }}
        title={`确认${actionLabel}${resource.label}？`}
        titleId="permission-removal-confirmation-title"
      />
      <ModalDialogBody>
        <p className="text-sm leading-6 text-ink-muted">
          {getRemovalDescription({
            overview: props.overview,
            removalMode,
            resourceName: resource.name,
          })}
        </p>
        {removalMode === 'delete' && props.overview.scope === 'workspace' && (
          <label className="mt-4 block text-sm text-ink-muted">
            <span className="mb-1.5 block">输入工作区名称以确认</span>
            <input
              aria-label="确认删除的工作区名称"
              value={confirmationName}
              className="h-9 w-full rounded-md border border-line bg-card px-3 text-sm outline-none focus:border-accent"
              disabled={isPending}
              onChange={(event) => {
                setConfirmationName(event.target.value);
              }}
            />
          </label>
        )}
        {error && (
          <p className="mt-3 text-sm text-danger-strong" role="alert">
            {error}
          </p>
        )}
      </ModalDialogBody>
      <ModalDialogFooter>
        <ModalDialogButton type="button" disabled={isPending} onClick={props.onClose}>
          取消
        </ModalDialogButton>
        <ModalDialogButton
          type="button"
          variant="danger"
          disabled={
            isPending ||
            (removalMode === 'delete' &&
              props.overview.scope === 'workspace' &&
              confirmationName !== resource.name)
          }
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                if (props.overview.scope === 'workspace') {
                  await deleteOrLeaveWorkspace({ workspaceId: resource.id });
                } else if (props.overview.scope === 'project') {
                  await deleteOrLeaveProject({ projectId: resource.id });
                } else {
                  await deleteDocument({ documentId: resource.id });
                }
                props.onMutated('delete', props.overview.scope);
              } catch {
                setError(`${resource.label}${actionLabel}失败，请稍后重试`);
              }
            });
          }}
        >
          {isPending ? `${actionLabel}中…` : `${actionLabel}${resource.label}`}
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
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  onNavigate: (input: PermissionOverviewInput) => void;
}) {
  const [isRemovalConfirmationOpen, setIsRemovalConfirmationOpen] = useState(false);
  const removalMode = props.overview ? getPermissionOverviewRemovalMode(props.overview) : null;
  const { overview } = props;

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
            <p className="py-10 text-center text-sm text-ink-faint">正在加载完整权限列表…</p>
          )}
          {!props.isLoading && props.error && (
            <p className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger-strong" role="alert">
              {props.error}
            </p>
          )}
          {!props.isLoading && props.overview?.scope === 'workspace' && (
            <p className="mb-4 text-sm leading-6 text-ink-muted">{props.overview.description}</p>
          )}
          {!props.isLoading && props.overview && (
            <PermissionResourceEditor overview={props.overview} onMutated={props.onMutated} />
          )}
          {!props.isLoading && props.overview && (
            <PermissionMemberManager overview={props.overview} onMutated={props.onMutated} />
          )}
          {!props.isLoading && props.overview?.scope === 'workspace' && (
            <WorkspaceAccessRequest overview={props.overview} />
          )}
          {!props.isLoading && props.overview?.scope === 'workspace' && (
            <WorkspaceAccessReviews overview={props.overview} onMutated={props.onMutated} />
          )}
          {!props.isLoading && props.overview?.scope === 'project' && (
            <ProjectAccessRequests overview={props.overview} onMutated={props.onMutated} />
          )}
          {!props.isLoading && props.overview?.groups.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-faint">暂无成员权限</p>
          )}
          {!props.isLoading &&
            overview?.groups.map((group) => (
              <section key={group.id} className="mb-5 last:mb-0">
                {(props.overview?.scope === 'workspace' || overview.groups.length > 1) && (
                  <h3 className="mb-2 text-sm font-semibold text-ink">{group.name}</h3>
                )}
                <div className="space-y-3 rounded-lg border border-line p-3">
                  {roles.map((role) => {
                    const members = group.members.filter((member) => member.role === role.id);

                    return (
                      <div key={role.id}>
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold tracking-[0.06em] text-ink-faint uppercase">
                          <span>{role.label}</span>
                          <span>{members.length}</span>
                        </div>
                        {members.length === 0 ? (
                          <p className="rounded-md bg-overlay px-2.5 py-2 text-xs text-ink-faint">
                            暂无成员
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {members.map((member) => (
                              <li
                                key={member.userId}
                                className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 ${
                                  member.isCurrentUser
                                    ? 'border-accent/30 bg-accent-soft'
                                    : 'border-transparent bg-overlay'
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-strong text-xs font-semibold text-ink-secondary"
                                >
                                  {member.displayName.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-ink">
                                      {member.displayName}
                                    </span>
                                    {member.isCurrentUser && (
                                      <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                                        你
                                      </span>
                                    )}
                                  </span>
                                  {member.email && member.email !== member.displayName && (
                                    <span className="block truncate text-xs text-ink-faint">
                                      {member.email}
                                    </span>
                                  )}
                                </span>
                                <PermissionMemberActions
                                  groupSource={group.source}
                                  member={member}
                                  overview={overview}
                                  onMutated={props.onMutated}
                                />
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

        {removalMode && (
          <ModalDialogFooter>
            <ModalDialogButton
              type="button"
              variant="danger"
              onClick={() => {
                setIsRemovalConfirmationOpen(true);
              }}
            >
              {removalMode === 'delete' ? '删除' : '退出'}
              {props.overview ? getResourceDetails(props.overview).label : '资源'}
            </ModalDialogButton>
          </ModalDialogFooter>
        )}
      </ModalDialog>
      {isRemovalConfirmationOpen && props.overview && (
        <PermissionRemovalConfirmationDialog
          overview={props.overview}
          onClose={() => {
            setIsRemovalConfirmationOpen(false);
          }}
          onMutated={props.onMutated}
        />
      )}
    </>
  );
}
