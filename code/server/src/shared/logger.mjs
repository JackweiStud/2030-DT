/**
 * 保持日志为单行结构化文本，现场联调时既能直接阅读，也方便后续采集。
 */
export function createLogger(sink = console) {
  function write(level, message, context = undefined) {
    const suffix = context === undefined ? "" : ` ${JSON.stringify(context)}`;
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${suffix}`;
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    sink[method](line);
  }

  return {
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
  };
}

export function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}
