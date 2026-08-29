/** Minimum password length enforced by Better Auth `emailAndPassword.minPasswordLength`. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Maps Better Auth password-reset error codes to user-facing copy.
 *
 * @param code - Client error code from `authClient.resetPassword`.
 * @returns A message that does not treat validation failures as expired tokens.
 */
export function getResetPasswordErrorMessage(code: string | undefined) {
  if (code === 'PASSWORD_TOO_SHORT') {
    return `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`;
  }

  if (code === 'PASSWORD_TOO_LONG') {
    return '密码过长，请缩短后重试';
  }

  if (code === 'INVALID_TOKEN') {
    return '链接无效或已过期，请重新申请';
  }

  return '重置失败，请稍后重试';
}
