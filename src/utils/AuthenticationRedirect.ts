/**
 * Builds the sign-in URL while preserving the protected destination.
 *
 * @param returnBackUrl - Protected URL requested by the unauthenticated user.
 * @returns The local sign-in URL with the protected redirect parameter.
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

/**
 * Preserves the local destination when switching between sign-in and sign-up.
 *
 * @param page - Target authentication page.
 * @param redirectUrl - Previously validated local destination.
 * @returns Authentication URL carrying the destination.
 */
export function createAuthenticationPageUrl(page: '/sign-in' | '/sign-up', redirectUrl: string) {
  const safeRedirectUrl = getSafeAuthenticationRedirect(redirectUrl) ?? '/dashboard';
  const authenticationUrl = new URL(page, 'https://knowmesh.local');
  authenticationUrl.searchParams.set('redirect_url', safeRedirectUrl);

  return `${authenticationUrl.pathname}${authenticationUrl.search}`;
}

/**
 * Marks a verified registration callback while preserving its local destination.
 *
 * @param redirectUrl - Previously validated local destination.
 * @returns Local callback URL with a registration success marker.
 */
export function createRegistrationSuccessRedirect(redirectUrl: string) {
  const safeRedirectUrl = getSafeAuthenticationRedirect(redirectUrl) ?? '/dashboard';
  const callbackUrl = new URL(safeRedirectUrl, 'https://knowmesh.local');
  callbackUrl.searchParams.set('registration', 'success');

  return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
}
