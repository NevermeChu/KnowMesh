import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSafeAuthenticationRedirect } from '@/utils/AuthenticationRedirect';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Effortlessly create an account through our intuitive sign-up process.',
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
    <SignUp
      path="/sign-up"
      fallbackRedirectUrl="/dashboard"
      forceRedirectUrl={returnBackUrl}
      signInForceRedirectUrl={returnBackUrl}
    />
  );
}
