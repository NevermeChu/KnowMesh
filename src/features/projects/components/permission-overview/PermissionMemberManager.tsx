'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { inviteProjectMember } from '@/features/permissions/server/ProjectMembers';
import { inviteWorkspaceMember } from '@/features/permissions/server/WorkspaceMembers';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { sectionTitleClassName } from './helpers';

/**
 * Renders member invite/add form for workspace and project scopes.
 *
 * @param props - Overview state and mutation callback.
 * @returns The member manager section.
 */
export function PermissionMemberManager(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
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
    <section className="mb-6 last:mb-0">
      <h3 className={`mb-2 ${sectionTitleClassName}`}>
        {props.overview.scope === 'workspace' ? '邀请新成员' : '添加项目成员'}
      </h3>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const invite =
                props.overview.scope === 'workspace'
                  ? inviteWorkspaceMember({
                      email,
                      workspaceId: props.overview.workspaceId,
                    })
                  : inviteProjectMember({
                      memberUserId: selectedUserId,
                      projectId: props.overview.project.id,
                    });
              await invite;
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
          <Input
            aria-label="受邀成员邮箱"
            className="flex-1"
            disabled={isPending}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="输入成员邮箱"
            required
            type="email"
            value={email}
          />
        ) : (
          <select
            aria-label="工作区成员"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm transition-colors outline-none placeholder:text-ink-faint-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
            disabled={isPending}
            onChange={(event) => {
              setSelectedUserId(event.target.value);
            }}
            required
            value={selectedUserId}
          >
            <option value="">选择工作区成员</option>
            {candidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        )}
        <Button disabled={isPending} type="submit" variant="primary">
          {props.overview.scope === 'workspace' ? '发送邀请' : '添加成员'}
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-xs text-danger-strong" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
