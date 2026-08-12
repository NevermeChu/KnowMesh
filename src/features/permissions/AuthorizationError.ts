export class AuthorizationError extends Error {
  constructor(message = '没有权限执行该操作') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
