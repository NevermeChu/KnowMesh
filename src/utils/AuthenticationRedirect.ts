/**
 * Builds the sign-in URL while preserving the protected destination.
 *
 * @param returnBackUrl - Protected URL requested by the unauthenticated user.
 * @returns The local sign-in URL with Clerk's redirect parameter.
 */
export function createSignInUrl(returnBackUrl: URL) {
  const signInUrl = new URL('/sign-in', returnBackUrl);
  signInUrl.searchParams.set(
    'redirect_url',
    `${returnBackUrl.pathname}${returnBackUrl.search}${returnBackUrl.hash}`,
  );

  return signInUrl;
}

/**
 * Accepts only application-local redirect paths from authentication query parameters.
 *
 * @param value - Untrusted redirect query parameter.
 * @returns A normalized local path, or null when the value could leave the application.
 */
export function getSafeAuthenticationRedirect(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }

  const baseUrl = new URL('https://knowmesh.local');
  const redirectUrl = new URL(candidate, baseUrl);

  if (redirectUrl.origin !== baseUrl.origin) {
    return null;
  }

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}
