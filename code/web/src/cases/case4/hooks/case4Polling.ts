/**
 * Case4 串行轮询原语与控制归属校验。
 * 四条链都从这里启停；吞吐 without / with 必须两个定时器。
 * 不做业务 status 解释（留给 controller）。
 */

export function controlMatchesAction(
  control: {
    case: string;
    command: string;
    dt_type: string;
  },
  kind: "start" | "reinit",
): boolean {
  if (control.case !== "case4") return false;
  if (kind === "start") {
    return control.command === "start" && control.dt_type === "with dt";
  }
  return control.command === "reinit" && control.dt_type === "with dt";
}

export function isInitIdle(control: {
  case: string;
  command: string;
  dt_type: string;
  status: string;
}): boolean {
  return (
    control.case === "case4" &&
    control.command === "init" &&
    control.status === ""
  );
}

export function isStartProgress(status: string): boolean {
  return (
    status === "" ||
    status === "execute success" ||
    status === "execute fail" ||
    status === "case complete"
  );
}

export function isReinitProgress(status: string): boolean {
  return (
    status === "" ||
    status === "execute success" ||
    status === "execute fail" ||
    status === "reinit complete"
  );
}

export type SerialPollHandle = {
  start: () => void;
  stop: () => void;
  get running(): boolean;
};

/**
 * 上一拍结束后再等 intervalMs。禁止 setInterval。
 */
export function createSerialPoll(options: {
  intervalMs: number;
  tick: (signal: AbortSignal) => Promise<void>;
}): SerialPollHandle {
  let timer: number | null = null;
  let ac: AbortController | null = null;
  let stopped = true;

  const clearTimer = () => {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const loop = async () => {
    if (stopped) return;
    ac = new AbortController();
    try {
      await options.tick(ac.signal);
    } catch {
      // 调用方在 tick 内处理；这里只保证不停地排下一拍
    }
    if (stopped) return;
    timer = window.setTimeout(() => {
      void loop();
    }, options.intervalMs);
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      void loop();
    },
    stop() {
      stopped = true;
      clearTimer();
      ac?.abort();
      ac = null;
    },
    get running() {
      return !stopped;
    },
  };
}
