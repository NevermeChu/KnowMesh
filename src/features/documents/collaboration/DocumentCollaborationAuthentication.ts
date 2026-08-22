import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { accountSchema, sessionSchema, userSchema, verificationSchema } from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';

const collaborationAuth = betterAuth({
  baseURL: getBaseUrl(),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      account: accountSchema,
      session: sessionSchema,
      user: userSchema,
      verification: verificationSchema,
    },
  }),
  secret: Env.BETTER_AUTH_SECRET,
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
