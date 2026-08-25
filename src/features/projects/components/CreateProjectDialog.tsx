'use client';

import { CreateNamedResourceDialog } from '@/components/ui/CreateNamedResourceDialog';
import { createProjectSchema } from '../CreateProjectSchema';
import type { ProjectArea } from '../Project';
import { createProject } from '../server/CreateProject';

export function CreateProjectDialog(props: {
  area: ProjectArea;
  onClose: () => void;
  workspaceId: string;
}) {
  const sectionLabel = props.area === 'personal' ? '个人区域' : '协作区域';

  return (
    <CreateNamedResourceDialog
      closeAriaLabel="关闭创建项目弹窗"
      description={`项目将创建在${sectionLabel}中`}
      failureMessage="创建项目失败，请稍后重试"
      fieldId="project-name"
      fieldLabel="项目名称"
      invalidNameMessage="项目名称无效"
      maxLength={80}
      nameSchema={createProjectSchema.shape.name}
      onClose={props.onClose}
      onCreate={async (name) => {
        await createProject({ name, workspaceId: props.workspaceId });
        props.onClose();
      }}
      placeholder="输入项目名称"
      title="创建项目"
      titleId="create-project-title"
    />
  );
}
