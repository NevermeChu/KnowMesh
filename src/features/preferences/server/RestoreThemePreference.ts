'use server';

import { cookies } from 'next/headers';
import { THEME_COOKIE, THEME_COOKIE_OPTIONS } from '@/features/preferences/Preferences';
import type { UserThemePreference } from '@/features/preferences/Preferences';
import { getPersistedTheme } from '@/features/preferences/server/GetPersistedTheme';

/**
 * Backfills the theme cookie from the persisted preference when the render cookie is missing.
 *
 * @returns The backfilled theme, or null without a session.
 */
export async function restoreThemePreference(): Promise<UserThemePreference | null> {
  const { hasSession, theme } = await getPersistedTheme();

  if (!hasSession) {
    return null;
  }

  const restored = theme ?? 'system';
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, restored, THEME_COOKIE_OPTIONS);

  return restored;
}
