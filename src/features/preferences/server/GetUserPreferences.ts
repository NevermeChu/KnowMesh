import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import type { UserPreferences } from '@/features/preferences/Preferences';
import { db } from '@/libs/DB';
import { userPreferencesSchema } from '@/models/Schema';

/**
 * Reads the authenticated user's preferences, defaulting to system defaults.
 *
 * @returns The user's current preferences.
 */
export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const { userId } = await auth.protect();

  const [preferences] = await db
    .select({ theme: userPreferencesSchema.theme })
    .from(userPreferencesSchema)
    .where(eq(userPreferencesSchema.userId, userId))
    .limit(1);

  return { theme: preferences?.theme ?? 'system' };
});
