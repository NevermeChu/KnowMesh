'use client';

import { UserMinus } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  removeProjectMember,
  updateProjectMemberRole,
} from '@/features/permissions/server/ProjectMembers';
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/features/permissions/server/WorkspaceMembers';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { canMutatePermissionGroupMembers } from '@/features/projects/PermissionOverview';
import { memberRoleLabels } from './helpers';
import { PermissionTransferConfirmationDialog } from './PermissionTransferConfirmationDialog';

/**
 * Renders one member's role presentation: a static badge for fixed roles and a
 * role select with removal that supports both promotion, demotion and ownership transfer
 * for manageable members.
 *
 * @param props - Member row context and mutation callback.
 * @returns The member role controls.
 */
export function PermissionMemberRole(props: {
  groupSource: PermissionOverview['groups'][number]['source'];
  member: PermissionOverview['groups'][number]['members'][number];
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
}) {
  const [isPending, startTransition] = useTransition();
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const canManage =
    props.overview.scope !== 'document' &&
    props.overview.permissions.includes(
      props.overview.scope === 'workspace' ? 'workspace.members.manage' : 'project.members.manage',
    ) &&
    canMutatePermissionGroupMembers({
      scope: props.overview.scope,
      source: props.groupSource,
    });
  const isCurrentUserOwner =
    props.overview.scope !== 'document' && props.overview.currentUserRole === 'owner';

  if (!canManage || props.member.role === 'owner') {
    return (
      <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
        {memberRoleLabels[props.member.role]}
      </span>
    );
  }

  return (
    <>
      <span className="flex shrink-0 items-center gap-1.5">
        <select
          aria-label={`${props.member.displayName}的角色`}
          className="h-8 rounded-lg border border-line bg-card px-2 text-xs font-medium text-ink-secondary transition-colors outline-none focus:border-accent disabled:opacity-45"
          disabled={isPending}
          onChange={(event) => {
            const role = event.target.value;

            if (role === '__transfer__') {
              setIsTransferDialogOpen(true);
              return;
            }

            if ((role !== 'editor' && role !== 'viewer') || role === props.member.role) {
              return;
            }

            startTransition(async () => {
              const mutateRole =
                props.overview.scope === 'workspace'
                  ? updateWorkspaceMemberRole({
                      memberUserId: props.member.userId,
                      role,
                      workspaceId: props.overview.workspaceId,
                    })
                  : updateProjectMemberRole({
                      memberUserId: props.member.userId,
                      projectId: props.overview.project.id,
                      role,
                    });
              await mutateRole;
              props.onMutated('update', props.overview.scope);
            });
          }}
          value={props.member.role}
        >
          <option value="editor">{memberRoleLabels.editor}</option>
          <option value="viewer">{memberRoleLabels.viewer}</option>
          {isCurrentUserOwner && !props.member.isCurrentUser && (
            <option value="__transfer__">转让所有权…</option>
          )}
        </select>
        <button
          aria-label={`移除${props.member.displayName}`}
          className="grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-danger/8 hover:text-danger disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const removeMember =
                props.overview.scope === 'workspace'
                  ? removeWorkspaceMember({
                      memberUserId: props.member.userId,
                      workspaceId: props.overview.workspaceId,
                    })
                  : removeProjectMember({
                      memberUserId: props.member.userId,
                      projectId: props.overview.project.id,
                    });
              await removeMember;
              props.onMutated('update', props.overview.scope);
            });
          }}
          title={`移除${props.member.displayName}`}
          type="button"
        >
          <UserMinus aria-hidden="true" className="size-4" strokeWidth={1.8} />
        </button>
      </span>
      {isTransferDialogOpen && (
        <PermissionTransferConfirmationDialog
          member={props.member}
          onClose={() => {
            setIsTransferDialogOpen(false);
          }}
          onMutated={props.onMutated}
          overview={props.overview}
        />
      )}
    </>
  );
}
