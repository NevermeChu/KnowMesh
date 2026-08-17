import { describe, expect, it } from 'vitest';
import { createSignInUrl, getSafeAuthenticationRedirect } from './AuthenticationRedirect';

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
