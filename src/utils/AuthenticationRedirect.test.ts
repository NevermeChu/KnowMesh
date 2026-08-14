import { describe, expect, it } from 'vitest';
import { createSignInUrl } from './AuthenticationRedirect';

describe(createSignInUrl, () => {
  it('preserves protected destination and invitation token', () => {
    const returnBackUrl = new URL(
      'https://knowmesh.example/invitations/accept?token=invitation_token',
    );
    const signInUrl = createSignInUrl(returnBackUrl);

    expect(signInUrl.pathname).toBe('/sign-in');
    expect(signInUrl.searchParams.get('redirect_url')).toBe(returnBackUrl.href);
  });
});
