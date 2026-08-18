export type AuthenticationErrorCode = 'EMAIL_NOT_VERIFIED' | 'UNAUTHENTICATED';

export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;

  constructor(code: AuthenticationErrorCode) {
    super(code === 'EMAIL_NOT_VERIFIED' ? '邮箱尚未验证' : '请先登录');
    this.code = code;
    this.name = 'AuthenticationError';
  }
}
