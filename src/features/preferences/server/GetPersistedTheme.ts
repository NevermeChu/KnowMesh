import 'server-only';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { getCurrentUser } from '@/features/auth/server/CurrentUser';
import { isUserThemePreference } from '@/features/preferences/Preferences';
import type { UserThemePreference } from '@/features/preferences/Preferences';
import { db } from '@/libs/DB';
import { userPreferencesSchema } from '@/models/Schema';

export type PersistedTheme = {
  /** Whether the request carries a signed-in session. */
  hasSession: boolean;
  /** The persisted theme, or null without a preference row. */
  theme: UserThemePreference | null;
};

/**
 * Reads the signed-in user's persisted theme for render-time resolution and cookie backfill.
 *
 * @returns The persisted theme plus whether the request has a session.
 */
export const getPersistedTheme = cache(async (): Promise<PersistedTheme> => {
  const user = await getCurrentUser();

  if (!user) {
    return { hasSession: false, theme: null };
  }

  const [preferences] = await db
    .select({ theme: userPreferencesSchema.theme })
    .from(userPreferencesSchema)
    .where(eq(userPreferencesSchema.userId, user.id))
    .limit(1);

  const theme = preferences?.theme;

  return { hasSession: true, theme: isUserThemePreference(theme) ? theme : null };
});
