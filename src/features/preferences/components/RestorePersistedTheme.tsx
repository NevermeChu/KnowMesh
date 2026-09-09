'use client';

import { useEffect } from 'react';
import { applyThemePreference } from '@/features/preferences/components/ApplyThemePreference';
import { restoreThemePreference } from '@/features/preferences/server/RestoreThemePreference';

/**
 * Backfills the theme cookie once after mount when the render cookie was missing.
 *
 * @returns Nothing; the component renders no UI.
 */
export function RestorePersistedTheme() {
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const theme = await restoreThemePreference().catch(() => null);

      if (!cancelled && theme) {
        applyThemePreference(theme);
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
