export const auditActions = [
  'workspace_renamed',
  'workspace_ownership_transferred',
  'workspace_invited',
  'workspace_invitation_revoked',
  'workspace_invitation_accepted',
  'workspace_member_role_updated',
  'workspace_member_removed',
  'workspace_access_approved',
  'workspace_access_rejected',
  'project_created',
  'project_renamed',
  'project_deleted',
  'project_ownership_transferred',
  'project_invited',
  'project_invitation_revoked',
  'project_invitation_accepted',
  'project_member_role_updated',
  'project_member_removed',
  'project_access_approved',
  'project_access_rejected',
] as const;

export const auditTargetKinds = ['workspace', 'project', 'member', 'invitation'] as const;

export type AuditAction = (typeof auditActions)[number];
export type AuditTargetKind = (typeof auditTargetKinds)[number];

export type AuditLogMetadata = {
  description?: string;
  nextName?: string;
  nextRole?: string;
  previousName?: string;
  previousRole?: string;
  resourceName?: string;
  targetUserEmail?: string | null;
  targetUserId?: string;
  targetUserName?: string;
  [key: string]: unknown;
};

export type AuditLogItem = {
  action: AuditAction;
  actor: {
    displayName: string;
    email: string | null;
    imageUrl: string | null;
    userId: string;
  };
  createdAt: Date;
  id: string;
  ipAddress: string | null;
  metadata: AuditLogMetadata;
  targetId: string | null;
  targetKind: AuditTargetKind | null;
  userAgent: string | null;
  workspaceId: string;
};

export const auditLogCategories = ['all', 'membership', 'permissions', 'resources'] as const;
export type AuditLogCategory = (typeof auditLogCategories)[number];

export const auditActionCategories: Record<AuditAction, AuditLogCategory> = {
  project_access_approved: 'permissions',
  project_access_rejected: 'permissions',
  project_created: 'resources',
  project_deleted: 'resources',
  project_invitation_accepted: 'membership',
  project_invitation_revoked: 'membership',
  project_invited: 'membership',
  project_member_removed: 'membership',
  project_member_role_updated: 'permissions',
  project_ownership_transferred: 'permissions',
  project_renamed: 'resources',
  workspace_access_approved: 'permissions',
  workspace_access_rejected: 'permissions',
  workspace_invitation_accepted: 'membership',
  workspace_invitation_revoked: 'membership',
  workspace_invited: 'membership',
  workspace_member_removed: 'membership',
  workspace_member_role_updated: 'permissions',
  workspace_ownership_transferred: 'permissions',
  workspace_renamed: 'resources',
};

export const auditActionLabels: Record<AuditAction, string> = {
  project_access_approved: '项目权限审批通过',
  project_access_rejected: '项目权限申请驳回',
  project_created: '创建项目',
  project_deleted: '删除项目',
  project_invitation_accepted: '接受项目邀请',
  project_invitation_revoked: '撤回项目邀请',
  project_invited: '发出项目邀请',
  project_member_removed: '移出项目成员',
  project_member_role_updated: '调整项目角色',
  project_ownership_transferred: '项目所有权转让',
  project_renamed: '重命名项目',
  workspace_access_approved: '工作区权限审批通过',
  workspace_access_rejected: '工作区权限申请驳回',
  workspace_invitation_accepted: '接受工作区邀请',
  workspace_invitation_revoked: '撤回工作区邀请',
  workspace_invited: '发出工作区邀请',
  workspace_member_removed: '移出工作区成员',
  workspace_member_role_updated: '调整工作区角色',
  workspace_ownership_transferred: '工作区所有权转让',
  workspace_renamed: '重命名工作区',
};
