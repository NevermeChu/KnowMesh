'use client';

import { useEffect } from 'react';
import { applyThemePreference } from '@/features/preferences/components/ApplyThemePreference';
import { isUserThemePreference } from '@/features/preferences/Preferences';

/**
 * Backfills the theme cookie once after mount when the render cookie was missing.
 *
 * @returns Nothing; the component renders no UI.
 */
export function RestorePersistedTheme() {
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const response = await fetch('/api/preferences/theme', { method: 'POST' });

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json();
        const theme =
          payload && typeof payload === 'object' && 'theme' in payload ? payload.theme : null;
        const candidate = typeof theme === 'string' ? theme : undefined;

        if (!cancelled && isUserThemePreference(candidate)) {
          applyThemePreference(candidate);
        }
      } catch {
        // 回填失败时保留服务端已渲染的主题
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
