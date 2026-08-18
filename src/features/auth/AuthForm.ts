/**
 * Reads a text field from browser FormData without coercing uploaded files.
 *
 * @param formData - Submitted browser form values.
 * @param name - Field name to read.
 * @returns The text value or an empty string for missing and file values.
 */
export function getFormText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}
