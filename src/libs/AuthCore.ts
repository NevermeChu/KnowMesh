import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { accountSchema, sessionSchema, userSchema, verificationSchema } from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';

/**
 * Builds the Better Auth options that every instance must share so session reads stay consistent.
 *
 * @returns Core options covering base URL, secret, and the authentication database adapter.
 */
export function getAuthenticationCoreOptions() {
  return {
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
  };
}
