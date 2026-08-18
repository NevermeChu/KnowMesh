import type { Metadata } from 'next';
import { AuthenticationPanel } from '@/components/auth/AuthenticationPanel';
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = { title: `忘记密码 · ${AppConfig.name}` };

export default function ForgotPasswordPage() {
  return (
    <AuthenticationPanel title="找回密码" description="我们会向你的注册邮箱发送一次性重置链接。">
      <PasswordRecoveryForm />
    </AuthenticationPanel>
  );
}
