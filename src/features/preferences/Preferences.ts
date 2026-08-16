export const userThemePreferences = ['light', 'dark', 'system'] as const;

export type UserThemePreference = (typeof userThemePreferences)[number];

export const contentWidthPercentages = [60, 70, 80, 90] as const;

export type ContentWidthPercentage = (typeof contentWidthPercentages)[number];

export const DEFAULT_CONTENT_WIDTH: ContentWidthPercentage = 80;

export type UserPreferences = {
  contentWidth: ContentWidthPercentage;
  theme: UserThemePreference;
};

/** Cookie mirroring the persisted theme so the root layout can render it before paint. */
export const THEME_COOKIE = 'knowmesh-theme';

/** Cookie mirroring the persisted content width so the root layout can size content before paint. */
export const CONTENT_WIDTH_COOKIE = 'knowmesh-content-width';

/**
 * Narrows an untrusted cookie value to a theme preference.
 *
 * @param value - Raw theme cookie value.
 * @returns True when the value is a supported theme preference.
 */
export function isUserThemePreference(value: string | undefined): value is UserThemePreference {
  return (userThemePreferences as readonly string[]).includes(value ?? '');
}

/**
 * Resolves an untrusted cookie value to a content width percentage, falling back to the default.
 *
 * @param value - Raw content width cookie value.
 * @returns The parsed percentage, or the default when unsupported.
 */
export function parseContentWidth(value: string | undefined): ContentWidthPercentage {
  const parsed = Number(value);
  const match = contentWidthPercentages.find((percentage) => percentage === parsed);

  return match ?? DEFAULT_CONTENT_WIDTH;
}
