import 'server-only';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { contentWidthPercentages, DEFAULT_CONTENT_WIDTH } from '@/features/preferences/Preferences';
import type { UserPreferences } from '@/features/preferences/Preferences';
import { db } from '@/libs/DB';
import { userPreferencesSchema } from '@/models/Schema';

/**
 * Coerces an untrusted database value to a content width percentage step.
 *
 * @param value - Raw integer stored in the database.
 * @returns The matching step, or the default when out of range.
 */
function resolveContentWidth(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return DEFAULT_CONTENT_WIDTH;
  }

  return (
    contentWidthPercentages.find((percentage) => percentage === value) ?? DEFAULT_CONTENT_WIDTH
  );
}

/**
 * Reads the authenticated user's preferences, defaulting to system defaults.
 *
 * @returns The user's current preferences.
 */
export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const { id: userId } = await requireUser();

  const [preferences] = await db
    .select({
      contentWidth: userPreferencesSchema.contentWidth,
      theme: userPreferencesSchema.theme,
    })
    .from(userPreferencesSchema)
    .where(eq(userPreferencesSchema.userId, userId))
    .limit(1);

  return {
    contentWidth: resolveContentWidth(preferences?.contentWidth),
    theme: preferences?.theme ?? 'system',
  };
});
