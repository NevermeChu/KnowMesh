import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthenticationPanel } from '@/components/auth/AuthenticationPanel';
import { EmailPasswordForm } from '@/features/auth/components/EmailPasswordForm';
import { getCurrentUser } from '@/features/auth/server/CurrentUser';
import { AppConfig } from '@/utils/AppConfig';
import { getSafeAuthenticationRedirect } from '@/utils/AuthenticationRedirect';

export const metadata: Metadata = {
  title: `登录 · ${AppConfig.name}`,
  description: '登录 KnowMesh 知序，面向团队的知识工作空间。',
};

export default async function SignInPage(props: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const returnBackUrl = getSafeAuthenticationRedirect(searchParams.redirect_url);
  const user = await getCurrentUser();

  if (user?.emailVerified) {
    redirect(returnBackUrl ?? '/dashboard');
  }

  return (
    <AuthenticationPanel title="欢迎回来" description="登录你的团队知识工作空间">
      <EmailPasswordForm mode="sign-in" redirectUrl={returnBackUrl ?? '/dashboard'} />
    </AuthenticationPanel>
  );
}
