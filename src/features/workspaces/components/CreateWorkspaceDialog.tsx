'use client';

import { CreateNamedResourceDialog } from '@/components/ui/CreateNamedResourceDialog';
import { createWorkspace } from '../server/CreateWorkspace';
import { createWorkspaceSchema } from '../WorkspaceSchema';

export function CreateWorkspaceDialog(props: { onClose: () => void; onCreated: () => void }) {
  return (
    <CreateNamedResourceDialog
      closeAriaLabel="关闭创建工作区弹窗"
      description="工作区用于组织个人与协作项目"
      failureMessage="创建工作区失败，请稍后重试"
      fieldId="workspace-name"
      fieldLabel="工作区名称"
      invalidNameMessage="工作区名称无效"
      maxLength={80}
      nameSchema={createWorkspaceSchema.shape.name}
      onClose={props.onClose}
      onCreate={async (name) => {
        await createWorkspace({ name });
        props.onCreated();
      }}
      placeholder="例如：产品团队"
      title="创建工作区"
      titleId="create-workspace-title"
    />
  );
}
