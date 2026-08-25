'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { updateDocument } from '@/features/documents/server/UpdateDocument';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';
import { updateProject } from '@/features/projects/server/UpdateProject';
import { updateWorkspace } from '@/features/workspaces/server/UpdateWorkspace';
import { getResourceDetails, getResourcePermission, sectionTitleClassName } from './helpers';

/**
 * Editor form for renaming the active workspace, project, or document resource.
 *
 * @param props - Resource overview and mutation callback.
 * @returns The resource editor form section.
 */
export function PermissionResourceEditor(props: {
  onMutated: (operation: 'delete' | 'update', scope: PermissionOverview['scope']) => void;
  overview: PermissionOverview;
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
    <section className="mb-6 last:mb-0">
      <h3 className={`mb-2 ${sectionTitleClassName}`}>基本信息</h3>
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
                const result = await updateDocument({
                  documentId: resource.id,
                  expectedTitleVersion: props.overview.document.titleVersion,
                  title: name,
                });
                if (result.status === 'conflict') {
                  setError('文件名称已在其他页面更新，请重新打开后再试');
                  return;
                }
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
          <Input
            aria-label={`${resource.label}名称`}
            disabled={isPending}
            maxLength={props.overview.scope === 'document' ? 200 : 80}
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
            value={name}
          />
        </label>
        <Button
          disabled={isPending || name.trim() === resource.name}
          type="submit"
          variant="primary"
        >
          {isPending ? '保存中…' : '保存名称'}
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
