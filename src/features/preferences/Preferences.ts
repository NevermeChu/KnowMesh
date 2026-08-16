export const userThemePreferences = ['light', 'dark', 'system'] as const;

export type UserThemePreference = (typeof userThemePreferences)[number];

export type UserPreferences = {
  theme: UserThemePreference;
};

/** Cookie mirroring the persisted theme so the root layout can render it before paint. */
export const THEME_COOKIE = 'knowmesh-theme';

/**
 * Narrows an untrusted cookie value to a theme preference.
 *
 * @param value - Raw theme cookie value.
 * @returns True when the value is a supported theme preference.
 */
export function isUserThemePreference(value: string | undefined): value is UserThemePreference {
  return (userThemePreferences as readonly string[]).includes(value ?? '');
}
