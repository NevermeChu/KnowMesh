import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSafeAuthenticationRedirect } from '@/utils/AuthenticationRedirect';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Seamlessly sign in to your account with our user-friendly login process.',
};

export default async function SignInPage(props: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const returnBackUrl = getSafeAuthenticationRedirect(searchParams.redirect_url);
  const { userId } = await auth();

  if (userId) {
    redirect(returnBackUrl ?? '/dashboard');
  }

  return (
    <SignIn
      path="/sign-in"
      fallbackRedirectUrl="/dashboard"
      forceRedirectUrl={returnBackUrl}
      signUpForceRedirectUrl={returnBackUrl}
    />
  );
}
