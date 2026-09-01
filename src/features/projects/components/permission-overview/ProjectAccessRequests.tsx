'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import {
  approveProjectAccessRequest,
  rejectProjectAccessRequest,
} from '@/features/permissions/server/ProjectMembers';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { memberRoleLabels, sectionTitleClassName } from './helpers';

/**
 * Lists and reviews pending project access requests.
 *
 * @param props - Project overview and mutation callback.
 * @returns The project access review section.
 */
export function ProjectAccessRequests(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: Extract<PermissionOverview, { scope: 'project' }>;
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
              <span className="text-ink-muted">
                {' '}
                申请成为{memberRoleLabels[request.requestedRole]}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await rejectProjectAccessRequest({
                      memberUserId: request.userId,
                      projectId: props.overview.project.id,
                    });
                    if (!result.ok) {
                      setReviewError(result.error);
                      return;
                    }
                    setReviewError(null);
                    props.onMutated('update', 'project');
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
                    const result = await approveProjectAccessRequest({
                      memberUserId: request.userId,
                      projectId: props.overview.project.id,
                    });
                    if (!result.ok) {
                      setReviewError(result.error);
                      return;
                    }
                    setReviewError(null);
                    props.onMutated('update', 'project');
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
