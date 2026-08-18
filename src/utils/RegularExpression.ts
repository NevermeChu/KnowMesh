/**
 * Escapes literal text before embedding it in a regular expression.
 *
 * @param value - Literal user-controlled text.
 * @returns Text safe to embed in a regular expression.
 */
export function escapeRegularExpression(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
