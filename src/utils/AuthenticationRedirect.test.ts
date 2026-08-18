import { describe, expect, it } from 'vitest';
import {
  createAuthenticationPageUrl,
  createRegistrationSuccessRedirect,
  createSignInUrl,
  getSafeAuthenticationRedirect,
} from './AuthenticationRedirect';

describe(createSignInUrl, () => {
  it('preserves protected destination and invitation token', () => {
    const returnBackUrl = new URL(
      'https://knowmesh.example/invitations/accept?token=invitation_token',
    );
    const signInUrl = createSignInUrl(returnBackUrl);

    expect(signInUrl.pathname).toBe('/sign-in');
    expect(signInUrl.searchParams.get('redirect_url')).toBe(
      '/invitations/accept?token=invitation_token',
    );
  });

  it('preserves notification destination url', () => {
    const returnBackUrl = new URL('https://knowmesh.example/notifications');
    const signInUrl = createSignInUrl(returnBackUrl);

    expect(signInUrl.pathname).toBe('/sign-in');
    expect(signInUrl.searchParams.get('redirect_url')).toBe('/notifications');
  });
});

describe(getSafeAuthenticationRedirect, () => {
  it('accepts local invitation path', () => {
    expect(getSafeAuthenticationRedirect('/invitations/accept?token=invitation_token')).toBe(
      '/invitations/accept?token=invitation_token',
    );
  });

  it('rejects external redirect target', () => {
    expect(
      getSafeAuthenticationRedirect('https://malicious.example/invitations/accept'),
    ).toBeNull();
    expect(getSafeAuthenticationRedirect('//malicious.example/invitations/accept')).toBeNull();
  });
});

describe(createAuthenticationPageUrl, () => {
  it('preserves destination when switching authentication page', () => {
    expect(
      createAuthenticationPageUrl('/sign-up', '/invitations/accept?token=invitation-token'),
    ).toBe('/sign-up?redirect_url=%2Finvitations%2Faccept%3Ftoken%3Dinvitation-token');
  });
});

describe(createRegistrationSuccessRedirect, () => {
  it('marks registration without dropping invitation token', () => {
    expect(createRegistrationSuccessRedirect('/invitations/accept?token=invitation-token')).toBe(
      '/invitations/accept?token=invitation-token&registration=success',
    );
  });
});
