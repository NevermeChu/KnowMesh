export const WORKSPACE_INVITATION_ROLE_LABEL = 'Viewer';

export const workspaceInvitationCopy = {
  action: '查看并接受邀请',
  eyebrow: '工作区邀请',
  title: '邀请你加入工作区',
} as const;

export type WorkspaceInvitationDisplayData = {
  expiresAtLabel: string;
  inviteeEmail: string;
  inviterName: string;
  roleLabel: string;
  workspaceName: string;
};

export type WorkspaceInvitationPageData =
  | { invitation: WorkspaceInvitationDisplayData; status: 'ready' }
  | { status: 'accepted' | 'email-mismatch' | 'expired' | 'invalid' | 'revoked' };

/**
 * Formats an invitation deadline consistently across email and web views.
 *
 * @param expiresAt - Invitation expiration instant.
 * @returns A China Standard Time display label.
 */
export function formatWorkspaceInvitationExpiration(expiresAt: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(expiresAt);
}

/**
 * Resolves a stable invitation-facing name from the local user profile.
 *
 * @param user - Minimal Better Auth profile fields needed for display.
 * @returns The preferred name, email, or product fallback.
 */
export function getWorkspaceInvitationInviterName(user: { email: string; name: string }) {
  const name = user.name.trim();

  return name || user.email || 'KnowMesh 成员';
}
