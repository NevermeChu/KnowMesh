'use client';

import { useState, useTransition } from 'react';
import type { WorkspaceProject } from '@/components/layout/AppSidebar/SidebarWorkspaceNavigationTypes';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import {
  ModalDialog,
  ModalDialogBody,
  ModalDialogFooter,
  ModalDialogHeader,
} from '@/components/ui/ModalDialog';
import { moveDocument } from '../server/MoveDocument';

/**
 * Renders a dialog to move a document to a different parent document or project.
 *
 * @param props - Dialog state, document to move, and available projects.
 * @returns The move document modal dialog.
 */
export function MoveDocumentDialog(props: {
  currentProject: WorkspaceProject;
  document: { id: string; label: string; parentId: string | null };
  projects: WorkspaceProject[];
  onClose: () => void;
  onMoved: (targetProjectId: string, targetParentId: string | null, documentId: string) => void;
}) {
  const [targetProjectId, setTargetProjectId] = useState(props.currentProject.id);
  const [targetParentId, setTargetParentId] = useState<string | null>(props.document.parentId);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const selectedProject =
    props.projects.find((project) => project.id === targetProjectId) ?? props.currentProject;

  // Find all descendant IDs of the moving document to avoid offering them as parent choices
  const invalidParentIds = new Set<string>([props.document.id]);
  if (targetProjectId === props.currentProject.id) {
    const childrenByParent = new Map<string, string[]>();
    for (const doc of props.currentProject.documents) {
      if (doc.parentId) {
        const existing = childrenByParent.get(doc.parentId);
        if (existing) {
          existing.push(doc.id);
        } else {
          childrenByParent.set(doc.parentId, [doc.id]);
        }
      }
    }

    let pendingIds = [props.document.id];
    while (pendingIds.length > 0) {
      const nextPending: string[] = [];
      for (const id of pendingIds) {
        const children = childrenByParent.get(id) ?? [];
        for (const childId of children) {
          invalidParentIds.add(childId);
          nextPending.push(childId);
        }
      }
      pendingIds = nextPending;
    }
  }

  const eligibleParentDocs = selectedProject.documents.filter(
    (doc) => !invalidParentIds.has(doc.id),
  );

  return (
    <ModalDialog
      dismissal={{
        ariaLabel: '关闭移动文件弹窗',
        isDisabled: isPending,
        onDismiss: props.onClose,
      }}
      surfaceClassName="w-full max-w-md"
      titleId="move-document-title"
    >
      <ModalDialogHeader
        closeButton={{ ariaLabel: '关闭', isDisabled: isPending, onClick: props.onClose }}
        description={`移动「${props.document.label}」至新的父级文档或项目`}
        title="移动文件"
        titleId="move-document-title"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);

          startTransition(async () => {
            try {
              await moveDocument({
                documentId: props.document.id,
                targetParentId,
                targetProjectId,
              });
              props.onMoved(targetProjectId, targetParentId, props.document.id);
            } catch (moveError) {
              setError(moveError instanceof Error ? moveError.message : '移动文件失败，请稍后重试');
            }
          });
        }}
      >
        <ModalDialogBody surfaceClassName="space-y-4">
          {props.projects.length > 1 && (
            <FormField htmlFor="target-project-select" label="目标项目">
              <select
                id="target-project-select"
                disabled={isPending}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                value={targetProjectId}
                onChange={(event) => {
                  setTargetProjectId(event.target.value);
                  setTargetParentId(null);
                }}
              >
                {props.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField error={error} htmlFor="target-parent-select" label="目标位置">
            <select
              id="target-parent-select"
              disabled={isPending}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              value={targetParentId ?? ''}
              onChange={(event) => {
                const { value } = event.target;
                setTargetParentId(value === '' ? null : value);
                if (error) {
                  setError(undefined);
                }
              }}
            >
              <option value="">（顶级文档 / 根目录）</option>
              {eligibleParentDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.label}
                </option>
              ))}
            </select>
          </FormField>
        </ModalDialogBody>
        <ModalDialogFooter>
          <Button disabled={isPending} onClick={props.onClose} type="button">
            取消
          </Button>
          <Button disabled={isPending} type="submit" variant="primary">
            {isPending ? '移动中…' : '确认移动'}
          </Button>
        </ModalDialogFooter>
      </form>
    </ModalDialog>
  );
}
