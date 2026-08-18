import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSignInUrl } from '@/utils/AuthenticationRedirect';

const protectedRoutePrefixes = [
  '/collaboration',
  '/dashboard',
  '/invitations',
  '/notifications',
  '/personal',
  '/search',
  '/settings',
  '/starred',
] as const;

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  if (isProtectedRoute(request.nextUrl.pathname) && !getSessionCookie(request)) {
    const signInUrl = createSignInUrl(request.nextUrl);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|api|.*\\..*).*)',
};
