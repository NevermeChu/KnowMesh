import { betterAuth } from 'better-auth';
import { getAuthenticationCoreOptions } from '@/libs/AuthCore';

const collaborationAuth = betterAuth({
  ...getAuthenticationCoreOptions(),
});

export async function getDocumentCollaborationIdentity(requestHeaders: Headers) {
  const session = await collaborationAuth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });

  if (!session?.user.emailVerified) {
    return null;
  }

  return {
    image: session.user.image ?? null,
    name: session.user.name,
    sessionId: session.session.id,
    userId: session.user.id,
  };
}
