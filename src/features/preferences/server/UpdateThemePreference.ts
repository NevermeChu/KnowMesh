'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { THEME_COOKIE } from '@/features/preferences/Preferences';
import type { UpdateUserThemeInput } from '@/features/preferences/PreferencesSchema';
import { updateUserThemeSchema } from '@/features/preferences/PreferencesSchema';
import { db } from '@/libs/DB';
import { userPreferencesSchema } from '@/models/Schema';

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Persists the authenticated user's theme preference and mirrors it into a cookie
 * so the root layout can apply it before first paint without a database read.
 *
 * @param input - Theme preference chosen in settings.
 */
export async function updateThemePreference(input: UpdateUserThemeInput) {
  const { userId } = await auth.protect();
  const { theme } = updateUserThemeSchema.parse(input);

  await db
    .insert(userPreferencesSchema)
    .values({ theme, userId })
    .onConflictDoUpdate({
      target: userPreferencesSchema.userId,
      set: { theme, updatedAt: new Date() },
    });

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    httpOnly: true,
    maxAge: THEME_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}
