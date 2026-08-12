import 'server-only';
import { Resend } from 'resend';
import { Env } from '@/libs/Env';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Sends a transactional email for a locally managed workspace invitation.
 *
 * @param options - Recipient, workspace name, and invitation acceptance URL.
 * @returns The Resend email identifier.
 */
export async function sendWorkspaceInvitationEmail(options: {
  acceptUrl: string;
  email: string;
  workspaceName: string;
}) {
  if (!Env.RESEND_API_KEY || !Env.RESEND_FROM_EMAIL) {
    throw new Error('Resend 邮件配置不完整');
  }

  const resend = new Resend(Env.RESEND_API_KEY);
  const workspaceName = escapeHtml(options.workspaceName);
  const acceptUrl = escapeHtml(options.acceptUrl);
  const { data, error } = await resend.emails.send({
    from: Env.RESEND_FROM_EMAIL,
    to: options.email,
    subject: `邀请你加入 ${options.workspaceName}`,
    text: `你被邀请加入 KnowMesh 工作区“${options.workspaceName}”。请在 7 天内打开以下链接接受邀请：${options.acceptUrl}`,
    html: `<p>你被邀请加入 KnowMesh 工作区“${workspaceName}”。</p><p><a href="${acceptUrl}">接受邀请</a></p><p>此邀请将在 7 天后过期。</p>`,
  });

  if (error || !data) {
    throw new Error(error?.message ?? '邀请邮件发送失败');
  }

  return { emailId: data.id };
}
