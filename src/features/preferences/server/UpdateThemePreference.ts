'use server';

import { cookies } from 'next/headers';
import { getCurrentUser } from '@/features/auth/server/CurrentUser';
import { THEME_COOKIE, THEME_COOKIE_OPTIONS } from '@/features/preferences/Preferences';
import type { UpdateUserThemeInput } from '@/features/preferences/PreferencesSchema';
import { updateUserThemeSchema } from '@/features/preferences/PreferencesSchema';
import { db } from '@/libs/DB';
import { userPreferencesSchema } from '@/models/Schema';

/**
 * Persists the theme preference into a cookie and, if authenticated, into the database.
 *
 * @param input - Theme preference chosen in settings or landing toggle.
 */
export async function updateThemePreference(input: UpdateUserThemeInput) {
  const user = await getCurrentUser();
  const { theme } = updateUserThemeSchema.parse(input);

  if (user) {
    await db
      .insert(userPreferencesSchema)
      .values({ theme, userId: user.id })
      .onConflictDoUpdate({
        target: userPreferencesSchema.userId,
        set: { theme, updatedAt: new Date() },
      });
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, THEME_COOKIE_OPTIONS);
}
