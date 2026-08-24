import { describe, expect, it } from 'vitest';
import {
  createAuthenticationPageUrl,
  createRegistrationSuccessRedirect,
  createSignInUrl,
  getSafeAuthenticationRedirect,
} from './AuthenticationRedirect';

describe('authentication redirects', () => {
  it('preserves local invitation destination across authentication flow', () => {
    const returnBackUrl = new URL(
      'https://knowmesh.example/invitations/accept?token=invitation_token',
    );
    const signInUrl = createSignInUrl(returnBackUrl);

    expect(signInUrl.pathname).toBe('/sign-in');
    expect(signInUrl.searchParams.get('redirect_url')).toBe(
      '/invitations/accept?token=invitation_token',
    );
    expect(
      createAuthenticationPageUrl('/sign-up', '/invitations/accept?token=invitation_token'),
    ).toBe('/sign-up?redirect_url=%2Finvitations%2Faccept%3Ftoken%3Dinvitation_token');
    expect(createRegistrationSuccessRedirect('/invitations/accept?token=invitation_token')).toBe(
      '/invitations/accept?token=invitation_token&registration=success',
    );
  });

  it('rejects external redirect targets', () => {
    expect(
      getSafeAuthenticationRedirect('https://malicious.example/invitations/accept'),
    ).toBeNull();
    expect(getSafeAuthenticationRedirect('//malicious.example/invitations/accept')).toBeNull();
    expect(getSafeAuthenticationRedirect('/\\malicious.example/invitations/accept')).toBeNull();
  });
});
