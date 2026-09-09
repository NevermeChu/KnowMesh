import { cookies } from 'next/headers';
import { THEME_COOKIE, THEME_COOKIE_OPTIONS } from '@/features/preferences/Preferences';
import { getPersistedTheme } from '@/features/preferences/server/GetPersistedTheme';
import { getBaseUrl } from '@/utils/Helpers';

/**
 * Backfills the theme mirror cookie from the persisted preference without re-rendering the route.
 *
 * @param request - Same-origin backfill request from the authenticated client.
 * @returns The backfilled theme, or null without a session.
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  if (origin && origin !== new URL(getBaseUrl()).origin) {
    return Response.json({ theme: null }, { status: 403 });
  }

  const { hasSession, theme } = await getPersistedTheme();

  if (!hasSession) {
    return Response.json({ theme: null }, { status: 401 });
  }

  const restored = theme ?? 'system';
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, restored, THEME_COOKIE_OPTIONS);

  return Response.json({ theme: restored });
}
