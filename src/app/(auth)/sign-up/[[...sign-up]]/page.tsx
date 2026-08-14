import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthenticationPanel } from '@/components/auth/AuthenticationPanel';
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
  const { userId } = await auth();

  if (userId) {
    redirect(returnBackUrl ?? '/dashboard');
  }

  return (
    <AuthenticationPanel title="创建账号" description="注册后将自动为你建立个人工作区。">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full',
            cardBox: 'w-full',
            card: 'w-full',
            header: 'hidden',
          },
        }}
        path="/sign-up"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl={returnBackUrl}
        signInForceRedirectUrl={returnBackUrl}
      />
    </AuthenticationPanel>
  );
}
