import { describe, expect, it } from 'vitest';
import { getResetPasswordErrorMessage, MIN_PASSWORD_LENGTH } from './PasswordPolicy';

describe('password policy', () => {
  it('uses twelve characters as the Better Auth minimum', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });

  it('does not describe a short password as an expired reset link', () => {
    expect(getResetPasswordErrorMessage('PASSWORD_TOO_SHORT')).toBe('密码至少需要 12 个字符');
  });

  it('keeps invalid-token copy for expired reset links', () => {
    expect(getResetPasswordErrorMessage('INVALID_TOKEN')).toBe('链接无效或已过期，请重新申请');
  });
});
