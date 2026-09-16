/** Case4 stub 内部固定错误，便于日志、测试和快速失败分类。 */

export class StubError extends Error {
  constructor(code, message, details = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined);
    this.name = "StubError";
    this.code = code;
    this.details = details;
  }
}

export function isStubError(error) {
  return error instanceof StubError;
}
