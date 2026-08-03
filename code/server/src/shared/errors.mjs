/**
 * 适配服务对外错误。HTTP 状态和业务错误码在抛出点同时确定，
 * 避免路由层根据底层异常临时猜测映射。
 */
export class AppError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options.details;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
