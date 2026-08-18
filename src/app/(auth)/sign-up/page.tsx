import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthenticationPanel } from '@/components/auth/AuthenticationPanel';
import { EmailPasswordForm } from '@/features/auth/components/EmailPasswordForm';
import { getCurrentUser } from '@/features/auth/server/CurrentUser';
import { AppConfig } from '@/utils/AppConfig';
import { getSafeAuthenticationRedirect } from '@/utils/AuthenticationRedirect';

export const metadata: Metadata = {
  title: `注册 · ${AppConfig.name}`,
  description: '注册 KnowMesh 知序，注册后自动建立个人工作区。',
};

export default async function SignUpPage(props: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const returnBackUrl = getSafeAuthenticationRedirect(searchParams.redirect_url);
  const user = await getCurrentUser();

  if (user?.emailVerified) {
    redirect(returnBackUrl ?? '/dashboard');
  }

  return (
    <AuthenticationPanel title="创建账号" description="注册后将自动为你建立个人工作区。">
      <EmailPasswordForm mode="sign-up" redirectUrl={returnBackUrl ?? '/dashboard'} />
    </AuthenticationPanel>
  );
}
