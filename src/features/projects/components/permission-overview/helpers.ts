import type { MemberRole, Permission } from '@/features/permissions/Permission';
import type { PermissionOverview } from '@/features/projects/PermissionOverview';

export const memberRoleLabels: Record<MemberRole, string> = {
  editor: '可编辑',
  owner: '所有者',
  viewer: '只读',
};

export const memberRoleOrder: Record<MemberRole, number> = { editor: 1, owner: 0, viewer: 2 };

export const sectionTitleClassName =
  'text-xs font-semibold tracking-[0.06em] text-ink-faint uppercase';

export function getResourceDetails(overview: PermissionOverview) {
  if (overview.scope === 'workspace') {
    return {
      id: overview.groups[0]?.id ?? '',
      label: '工作区' as const,
      name: overview.groups[0]?.name ?? '',
    };
  }

  if (overview.scope === 'project') {
    return { id: overview.project.id, label: '项目' as const, name: overview.project.name };
  }

  return { id: overview.document.id, label: '文件' as const, name: overview.document.title };
}

export function getResourcePermission(options: {
  operation: 'delete' | 'update';
  scope: PermissionOverview['scope'];
}): Permission {
  return `${options.scope}.${options.operation}`;
}

export function getDeleteConsequence(scope: PermissionOverview['scope']) {
  if (scope === 'workspace') {
    return '，其中的项目和文件也会一并删除。';
  }

  if (scope === 'project') {
    return '，其中的文件也会一并删除。';
  }

  return '。';
}

export function getRemovalDescription(options: {
  overview: PermissionOverview;
  removalMode: 'delete' | 'leave' | null;
  resourceName: string;
}) {
  if (options.removalMode === 'leave') {
    if (options.overview.scope === 'workspace') {
      return `退出“${options.resourceName}”后，你拥有的项目及文件会一并删除；其他人的资源保持不变。`;
    }

    return `退出“${options.resourceName}”后，你将失去访问权限，资源及其他成员不受影响。`;
  }

  return `“${options.resourceName}”删除后无法恢复${getDeleteConsequence(options.overview.scope)}`;
}
