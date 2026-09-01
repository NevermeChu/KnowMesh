'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import {
  approveWorkspaceAccessRequest,
  rejectWorkspaceAccessRequest,
  requestWorkspaceEditAccess,
} from '@/features/permissions/server/WorkspaceMembers';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { sectionTitleClassName } from './helpers';

/**
 * Renders an access request prompt for viewers in a workspace.
 *
 * @param props - Workspace overview.
 * @returns The access request prompt section.
 */
export function WorkspaceAccessRequest(props: {
  overview: Extract<PermissionOverview, { scope: 'workspace' }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [didRequest, setDidRequest] = useState(false);

  if (props.overview.currentUserRole !== 'viewer' || didRequest) {
    return null;
  }

  return (
    <section className="mb-6 last:mb-0">
      <h3 className={`mb-2 ${sectionTitleClassName}`}>工作区编辑权限</h3>
      <p className="text-sm leading-6 text-ink-muted">
        你当前是只读成员，可以浏览工作区结构；创建项目需要可编辑权限。
      </p>
      <div className="mt-3">
        <Button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await requestWorkspaceEditAccess({ workspaceId: props.overview.workspaceId });
              setDidRequest(true);
            });
          }}
          type="button"
          variant="primary"
        >
          {isPending ? '提交中…' : '申请编辑权限'}
        </Button>
      </div>
    </section>
  );
}

/**
 * Lists and reviews pending workspace access requests.
 *
 * @param props - Workspace overview and mutation callback.
 * @returns The workspace access review section.
 */
export function WorkspaceAccessReviews(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: Extract<PermissionOverview, { scope: 'workspace' }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (props.overview.requests.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 last:mb-0">
      <h3 className={`mb-2 ${sectionTitleClassName}`}>待审批申请</h3>
      {reviewError ? (
        <p
          className="mb-2 rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger-strong"
          role="alert"
        >
          {reviewError}
        </p>
      ) : null}
      <ul className="space-y-2">
        {props.overview.requests.map((request) => (
          <li
            className="flex items-center gap-3 rounded-lg bg-overlay px-3 py-2.5"
            key={request.userId}
          >
            <span className="min-w-0 flex-1 text-sm text-ink">
              {request.displayName}
              <span className="text-ink-muted"> 申请成为可编辑成员</span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await rejectWorkspaceAccessRequest({
                      memberUserId: request.userId,
                      workspaceId: props.overview.workspaceId,
                    });
                    if (!result.ok) {
                      setReviewError(result.error);
                      return;
                    }
                    setReviewError(null);
                    props.onMutated('update', 'workspace');
                  });
                }}
                type="button"
                variant="neutral"
              >
                拒绝
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await approveWorkspaceAccessRequest({
                      memberUserId: request.userId,
                      workspaceId: props.overview.workspaceId,
                    });
                    if (!result.ok) {
                      setReviewError(result.error);
                      return;
                    }
                    setReviewError(null);
                    props.onMutated('update', 'workspace');
                  });
                }}
                type="button"
                variant="primary"
              >
                批准
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
