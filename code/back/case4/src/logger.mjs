/**
 * 单行结构化日志。step 事件默认只在 debug 输出，控制边沿始终为 info。
 */

export function createLogger(level = "info", sink = console) {
  const debugEnabled = level === "debug";

  function write(kind, message, context = {}) {
    const payload = {
      caseId: "case4",
      ...context,
    };
    const line = `[case4-stub] ${kind} ${message} ${JSON.stringify(payload)}`;
    const method = kind === "error" ? "error" : kind === "warn" ? "warn" : "log";
    sink[method](line);
  }

  return {
    debug(message, context) {
      if (debugEnabled) write("debug", message, context);
    },
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
  };
}

export function createSilentLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}
