import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { sessionSchema, userSchema } from '@/models/Schema';

/**
 * Checks that an authenticated session still belongs to a verified user and has not expired.
 *
 * @param options - Session and user identifiers captured during connection authentication.
 * @returns Whether the session remains active.
 */
export async function isSessionActive(options: { sessionId: string; userId: string }) {
  const [session] = await db
    .select({ id: sessionSchema.id })
    .from(sessionSchema)
    .innerJoin(userSchema, eq(userSchema.id, sessionSchema.userId))
    .where(
      and(
        eq(sessionSchema.id, options.sessionId),
        eq(sessionSchema.userId, options.userId),
        gt(sessionSchema.expiresAt, new Date()),
        eq(userSchema.emailVerified, true),
      ),
    )
    .limit(1);

  return session !== undefined;
}
