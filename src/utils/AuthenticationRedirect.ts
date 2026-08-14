/**
 * Builds the sign-in URL while preserving the protected destination.
 *
 * @param returnBackUrl - Protected URL requested by the unauthenticated user.
 * @returns The local sign-in URL with Clerk's redirect parameter.
 */
export function createSignInUrl(returnBackUrl: URL) {
  const signInUrl = new URL('/sign-in', returnBackUrl);
  signInUrl.searchParams.set('redirect_url', returnBackUrl.href);

  return signInUrl;
}
