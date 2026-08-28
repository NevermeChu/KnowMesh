import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Env } from '@/libs/Env';
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

function connectSrcOrigins(urlString: string) {
  const url = new URL(urlString);
  const isSecure = url.protocol === 'https:' || url.protocol === 'wss:';
  return [
    `${isSecure ? 'https:' : 'http:'}//${url.host}`,
    `${isSecure ? 'wss:' : 'ws:'}//${url.host}`,
  ];
}

function createContentSecurityPolicy(nonce: string) {
  const connectSources = [
    ...new Set([
      "'self'",
      ...connectSrcOrigins(Env.NEXT_PUBLIC_COLLABORATION_URL),
      ...connectSrcOrigins(Env.NEXT_PUBLIC_WHITEBOARD_COLLABORATION_URL),
    ]),
  ];
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (Env.NODE_ENV === 'development') {
    scriptSources.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(Env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  requestHeaders.set('x-nonce', nonce);

  let response: NextResponse;
  if (isProtectedRoute(request.nextUrl.pathname) && !getSessionCookie(request)) {
    const signInUrl = createSignInUrl(request.nextUrl);
    response = NextResponse.redirect(signInUrl);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|api|.*\\..*).*)',
};
