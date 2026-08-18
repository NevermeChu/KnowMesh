'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import type {
  PermissionOverview,
  PermissionOverviewInput,
} from '@/features/projects/PermissionOverview';
import { getPermissionOverviewRemovalMode } from '@/features/projects/PermissionOverview';
import { getResourceDetails } from './permission-overview/helpers';
import { PermissionGroupList } from './permission-overview/PermissionGroupList';
import { PermissionMemberManager } from './permission-overview/PermissionMemberManager';
import { PermissionOverviewTitle } from './permission-overview/PermissionOverviewTitle';
import { PermissionRemovalConfirmationDialog } from './permission-overview/PermissionRemovalConfirmationDialog';
import { PermissionResourceEditor } from './permission-overview/PermissionResourceEditor';
import { ProjectAccessRequests } from './permission-overview/ProjectAccessRequests';
import {
  WorkspaceAccessRequest,
  WorkspaceAccessReviews,
} from './permission-overview/WorkspaceAccessReviews';
import { WorkspacePendingInvitations } from './permission-overview/WorkspacePendingInvitations';

function PermissionOverviewContent(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
}) {
  return (
    <>
      {props.overview.scope === 'workspace' && (
        <p className="mb-6 text-sm leading-6 text-ink-muted">{props.overview.description}</p>
      )}
      <PermissionResourceEditor onMutated={props.onMutated} overview={props.overview} />
      <PermissionMemberManager onMutated={props.onMutated} overview={props.overview} />
      {props.overview.scope === 'workspace' && (
        <>
          <WorkspacePendingInvitations onMutated={props.onMutated} overview={props.overview} />
          <WorkspaceAccessRequest overview={props.overview} />
          <WorkspaceAccessReviews onMutated={props.onMutated} overview={props.overview} />
        </>
      )}
      {props.overview.scope === 'project' && (
        <ProjectAccessRequests onMutated={props.onMutated} overview={props.overview} />
      )}
      <PermissionGroupList onMutated={props.onMutated} overview={props.overview} />
    </>
  );
}

/**
 * Displays a permission overview and membership management dialog for the selected resource.
 *
 * @param props - Loading state, resolved permissions, and close behavior.
 * @returns The permission dialog.
 */
export function PermissionOverviewDialog(props: {
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  onNavigate: (input: PermissionOverviewInput) => void;
  overview: PermissionOverview | null;
}) {
  const [isRemovalConfirmationOpen, setIsRemovalConfirmationOpen] = useState(false);
  const removalMode = props.overview ? getPermissionOverviewRemovalMode(props.overview) : null;

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
            <PermissionOverviewTitle onNavigate={props.onNavigate} overview={props.overview} />
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
          {!props.isLoading && props.overview && (
            <PermissionOverviewContent onMutated={props.onMutated} overview={props.overview} />
          )}
        </ModalDialogBody>

        {removalMode && (
          <ModalDialogFooter>
            <Button
              onClick={() => {
                setIsRemovalConfirmationOpen(true);
              }}
              type="button"
              variant="danger"
            >
              {removalMode === 'delete' ? '删除' : '退出'}
              {props.overview ? getResourceDetails(props.overview).label : '资源'}
            </Button>
          </ModalDialogFooter>
        )}
      </ModalDialog>
      {isRemovalConfirmationOpen && props.overview && (
        <PermissionRemovalConfirmationDialog
          onClose={() => {
            setIsRemovalConfirmationOpen(false);
          }}
          onMutated={props.onMutated}
          overview={props.overview}
        />
      )}
    </>
  );
}
