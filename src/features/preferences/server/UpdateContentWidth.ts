'use server';

import { cookies } from 'next/headers';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { CONTENT_WIDTH_COOKIE } from '@/features/preferences/Preferences';
import type { UpdateContentWidthInput } from '@/features/preferences/PreferencesSchema';
import { updateContentWidthSchema } from '@/features/preferences/PreferencesSchema';
import { db } from '@/libs/DB';
import { userPreferencesSchema } from '@/models/Schema';

const CONTENT_WIDTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Persists the authenticated user's content width preference and mirrors it into a
 * cookie so the root layout can size content before paint without a database read.
 *
 * @param input - Content width percentage chosen from the content toolbar.
 */
export async function updateContentWidth(input: UpdateContentWidthInput) {
  const { id: userId } = await requireUser();
  const { width } = updateContentWidthSchema.parse(input);

  await db
    .insert(userPreferencesSchema)
    .values({ contentWidth: width, userId })
    .onConflictDoUpdate({
      target: userPreferencesSchema.userId,
      set: { contentWidth: width, updatedAt: new Date() },
    });

  const cookieStore = await cookies();
  cookieStore.set(CONTENT_WIDTH_COOKIE, String(width), {
    httpOnly: true,
    maxAge: CONTENT_WIDTH_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  });
}
