import 'server-only';
import { Resend } from 'resend';
import { WorkspaceInvitationEmail } from '@/features/emails/components/WorkspaceInvitationEmail';
import type { WorkspaceInvitationDisplayData } from '@/features/workspaces/WorkspaceInvitation';
import { Env } from '@/libs/Env';

/**
 * Sends a transactional email for a locally managed workspace invitation.
 *
 * @param options - Recipient, invitation display data, and acceptance URL.
 * @returns The Resend email identifier.
 */
export async function sendWorkspaceInvitationEmail(options: {
  acceptUrl: string;
  invitation: WorkspaceInvitationDisplayData;
}) {
  if (!Env.RESEND_API_KEY || !Env.RESEND_FROM_EMAIL) {
    if (Env.NODE_ENV === 'development' || Env.NODE_ENV === 'test') {
      console.info(
        `[Workspace Invitation Email] To: ${options.invitation.inviteeEmail} | URL: ${options.acceptUrl}`,
      );
      return { emailId: `dev-invitation-${Date.now()}` };
    }

    throw new Error('Resend 邮件配置不完整');
  }

  const resend = new Resend(Env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: Env.RESEND_FROM_EMAIL,
    to: options.invitation.inviteeEmail,
    subject: `邀请你加入 ${options.invitation.workspaceName}`,
    text: `${options.invitation.inviterName} 邀请你加入 KnowMesh 工作区“${options.invitation.workspaceName}”，角色为 ${options.invitation.roleLabel}。请在 ${options.invitation.expiresAtLabel} 前查看并接受邀请：${options.acceptUrl}`,
    react: (
      <WorkspaceInvitationEmail acceptUrl={options.acceptUrl} invitation={options.invitation} />
    ),
  });

  if (error || !data) {
    throw new Error(error?.message ?? '邀请邮件发送失败');
  }

  return { emailId: data.id };
}
