import 'server-only';
import { Resend } from 'resend';
import { AuthenticationEmail } from '@/features/emails/components/AuthenticationEmail';
import { Env } from '@/libs/Env';

type AuthenticationEmailKind = 'password-reset' | 'verification';

const authenticationEmailCopy = {
  'password-reset': {
    actionLabel: '重置密码',
    description: '我们收到了重置你的 KnowMesh 密码的请求。此链接将在一小时后失效。',
    preview: '重置你的 KnowMesh 密码',
    subject: '重置 KnowMesh 密码',
    title: '重置密码',
  },
  verification: {
    actionLabel: '验证邮箱',
    description: '请验证此邮箱以完成 KnowMesh 账户注册。此链接将在一小时后失效。',
    preview: '验证你的 KnowMesh 邮箱',
    subject: '验证 KnowMesh 邮箱',
    title: '验证邮箱',
  },
} satisfies Record<AuthenticationEmailKind, Record<string, string>>;

/**
 * Sends a Better Auth verification or password-reset email through Resend.
 *
 * @param options - Email kind, recipient, and one-time action URL.
 * @returns The Resend email identifier.
 */
export async function sendAuthenticationEmail(options: {
  kind: AuthenticationEmailKind;
  to: string;
  url: string;
}) {
  if (!Env.RESEND_API_KEY || !Env.RESEND_FROM_EMAIL) {
    if (Env.NODE_ENV === 'development' || Env.NODE_ENV === 'test') {
      console.info(`[Auth Email] (${options.kind}) To: ${options.to} | Action URL: ${options.url}`);
      return { emailId: `dev-auth-${options.kind}-${Date.now()}` };
    }

    throw new Error('Resend 邮件配置不完整');
  }

  const copy = authenticationEmailCopy[options.kind];
  const resend = new Resend(Env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: Env.RESEND_FROM_EMAIL,
    to: options.to,
    subject: copy.subject,
    text: `${copy.description}\n${options.url}`,
    react: <AuthenticationEmail {...copy} url={options.url} />,
  });

  if (error || !data) {
    throw new Error(error?.message ?? '认证邮件发送失败');
  }

  return { emailId: data.id };
}
