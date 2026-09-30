export type ViewTransform = {
  scale: number;
  rotation: number;
  /** 相对视窗宽/高的百分比。 */
  offsetX: number;
  offsetY: number;
};

export function loadCase2MapView(env: Record<string, unknown>) {
  const read = (key: string, fallback: number, min = -Infinity, max = Infinity) => {
    const raw = env[key];
    if (typeof raw !== "string" || !raw.trim()) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  };
  return {
    debugInfo: env.VITE_CASE2_MAP_DEBUG_INFO === "true" || env.VITE_CASE2_MAP_DEBUG_INFO === "1",
    view: {
      scale: read("VITE_CASE2_MAP_SCALE", 1, 0.5, 5),
      rotation: read("VITE_CASE2_MAP_ROTATION_DEG", 0, -90, 90),
      offsetX: read("VITE_CASE2_MAP_OFFSET_X_PERCENT", 0),
      offsetY: read("VITE_CASE2_MAP_OFFSET_Y_PERCENT", 0),
    } satisfies ViewTransform,
  };
}

export function formatCase2MapView(view: ViewTransform): string {
  return [
    `VITE_CASE2_MAP_SCALE=${view.scale}`,
    `VITE_CASE2_MAP_ROTATION_DEG=${view.rotation}`,
    `VITE_CASE2_MAP_OFFSET_X_PERCENT=${view.offsetX}`,
    `VITE_CASE2_MAP_OFFSET_Y_PERCENT=${view.offsetY}`,
  ].join("\n");
}
