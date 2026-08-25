import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';
import { AuthenticationError } from '@/features/auth/AuthenticationError';
import { auth } from '@/libs/Auth';

export type AuthenticatedUser = {
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
};

export type AuthenticatedSession = {
  sessionId: string;
  user: AuthenticatedUser;
};

const getCurrentSession = cache(async (): Promise<AuthenticatedSession | null> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  return {
    sessionId: session.session.id,
    user: {
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      id: session.user.id,
      image: session.user.image ?? null,
      name: session.user.name,
    },
  };
});

/**
 * Reads and validates the current Better Auth session from request headers.
 *
 * @returns The stable current-user shape, or null without a session.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const session = await getCurrentSession();
  return session?.user ?? null;
});

/**
 * Requires a verified Better Auth session for a protected long-lived connection.
 *
 * @returns The verified user and stable session identifier.
 * @throws AuthenticationError when the session is missing or the email is unverified.
 */
export async function requireAuthenticatedSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthenticationError('UNAUTHENTICATED');
  }

  if (!session.user.emailVerified) {
    throw new AuthenticationError('EMAIL_NOT_VERIFIED');
  }

  return session;
}

/**
 * Requires a verified Better Auth user for a protected server entry point.
 *
 * @returns The verified current user.
 * @throws AuthenticationError when the session is missing or the email is unverified.
 */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationError('UNAUTHENTICATED');
  }

  if (!user.emailVerified) {
    throw new AuthenticationError('EMAIL_NOT_VERIFIED');
  }

  return user;
}
