import type { UserThemePreference } from '@/features/preferences/Preferences';

/**
 * Applies a theme preference to the document root, mirroring the root layout init
 * script so switches take effect instantly.
 *
 * @param theme - Theme preference to apply.
 */
export function applyThemePreference(theme: UserThemePreference) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle(
    'dark',
    theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
  );
}
