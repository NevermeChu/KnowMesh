/**
 * Escapes special characters before embedding user input in a SQL LIKE / ILIKE pattern.
 *
 * @param value - Literal user-controlled search text.
 * @returns Text safe to use in a SQL LIKE or ILIKE pattern with literal matching.
 */
export function escapeSqlLikePattern(value: string) {
  return value.replaceAll(/[%_\\]/gu, '\\$&');
}
