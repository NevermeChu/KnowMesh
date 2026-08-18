'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { revokeWorkspaceInvitation } from '@/features/permissions/server/WorkspaceMembers';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { sectionTitleClassName } from './helpers';

/**
 * Displays pending invitations for workspace and provides revocation action.
 *
 * @param props - Workspace overview and mutation callback.
 * @returns The pending invitations section.
 */
export function WorkspacePendingInvitations(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: Extract<PermissionOverview, { scope: 'workspace' }>;
}) {
  const [isPending, startTransition] = useTransition();

  if (props.overview.invitations.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 last:mb-0">
      <h3 className={`mb-2 ${sectionTitleClassName}`}>待接受邀请</h3>
      <ul className="space-y-2">
        {props.overview.invitations.map((invitation) => (
          <li
            className="flex items-center gap-3 rounded-lg bg-overlay px-3 py-2.5"
            key={invitation.id}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {invitation.email}
              </span>
              <span className="block text-xs text-ink-faint">
                {new Date(invitation.expiresAt).toLocaleDateString('zh-CN')} 过期
              </span>
            </div>
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await revokeWorkspaceInvitation({
                    invitationId: invitation.id,
                    workspaceId: props.overview.workspaceId,
                  });
                  props.onMutated('update', 'workspace');
                });
              }}
              type="button"
              variant="neutral"
            >
              撤销
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
