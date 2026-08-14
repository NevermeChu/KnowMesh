import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSignInUrl } from '@/utils/AuthenticationRedirect';

const protectedRoutePrefixes = [
  '/collaboration',
  '/dashboard',
  '/invitations',
  '/personal',
  '/search',
  '/settings',
  '/starred',
] as const;

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request.nextUrl.pathname)) {
    const signInUrl = createSignInUrl(request.nextUrl);

    await auth.protect({
      unauthenticatedUrl: signInUrl.toString(),
    });
  }

  return NextResponse.next();
});

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|api|.*\\..*).*)',
};
