import type { Metadata } from 'next';
import { AuthenticationPanel } from '@/components/auth/AuthenticationPanel';
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = { title: `重置密码 · ${AppConfig.name}` };

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token;

  return (
    <AuthenticationPanel title="设置新密码" description="输入新密码以完成账户恢复。">
      <PasswordRecoveryForm token={token} />
    </AuthenticationPanel>
  );
}
