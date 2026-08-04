import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/collaboration(.*)',
  '/dashboard(.*)',
  '/personal(.*)',
  '/search(.*)',
  '/settings(.*)',
  '/starred(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    const signInUrl = new URL('/sign-in', request.url);

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
