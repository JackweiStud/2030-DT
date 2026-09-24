export type Triple = [number, number, number];
export interface ModelConfig {
  position: Triple;
  target: Triple;
  rotation: Triple;
  scale: number;
  zoom: number;
  panSpeed: number;
  rotateSpeed: number;
  zoomSpeed: number;
}
export function loadConfig(env: Record<string, unknown>) {
  const num = (key: string, fallback: number, positive = false) => {
    const raw = env[key];
    const n = raw === undefined || raw === "" ? fallback : Number(raw);
    if (!Number.isFinite(n) || (positive && n <= 0)) throw new Error(key);
    return n;
  };
  const bool = (key: string) => {
    const raw = env[key];
    if (raw === undefined || raw === "" || raw === "false" || raw === "0")
      return false;
    if (raw === "true" || raw === "1") return true;
    throw new Error(key);
  };
  const triple = (key: string, fallback: Triple): Triple => {
    const raw = env[key];
    if (raw === undefined || raw === "") return fallback;
    const values = String(raw).split(",").map(Number);
    if (
      values.length !== 3 ||
      values.some((n) => !Number.isFinite(n)) ||
      String(raw)
        .split(",")
        .some((s) => !s.trim())
    )
      throw new Error(key);
    return values as Triple;
  };
  const model = (name: string): ModelConfig => {
    const p = `VITE_CASE1_${name}_`;
    const position = triple(p + "CAMERA_POSITION", [1, 0.9, 1]);
    const target = triple(p + "CAMERA_TARGET", [0, 0, 0]);
    if (position.every((v, i) => v === target[i]))
      throw new Error(p + "CAMERA_POSITION");
    return {
      position,
      target,
      rotation: triple(p + "MODEL_ROTATION", [0, 0, 0]),
      scale: num(p + "MODEL_SCALE", 1, true),
      zoom: num(p + "CAMERA_ZOOM", 1, true),
      panSpeed: num(p + "PAN_SPEED", 1, true),
      rotateSpeed: num(p + "ROTATE_SPEED", 1, true),
      zoomSpeed: num(p + "ZOOM_SPEED", 1, true),
    };
  };
  const digits = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw === "") return fallback;
    if (!/^\d+$/.test(String(raw).trim())) throw new Error(key);
    return Number(raw);
  };
  const alpha = num("VITE_CASE1_HEATMAP_ALPHA", 0.9);
  const x0 = digits("VITE_CASE1_HEATMAP_X0", 0);
  const y0 = digits("VITE_CASE1_HEATMAP_Y0", 0);
  const x1 = digits("VITE_CASE1_HEATMAP_X1", 2);
  const y1 = digits("VITE_CASE1_HEATMAP_Y1", 2);
  const cell = digits("VITE_CASE1_HEATMAP_CELL", 4);
  const gap = digits("VITE_CASE1_HEATMAP_GAP", 0);
  const channel = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined) return fallback;
    if (!/^\d+$/.test(String(raw).trim())) throw new Error(key);
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0 || n > 255) throw new Error(key);
    return n;
  };
  if (
    !(alpha > 0 && alpha <= 1) ||
    cell < 1 ||
    x1 - x0 < 2 ||
    y1 - y0 < 2
  )
    throw new Error("VITE_CASE1_HEATMAP_*");
  const rfViewScale = num("VITE_CASE1_RF_VIEW_SCALE", 1, true);
  const rfViewRotation = num("VITE_CASE1_RF_VIEW_ROTATION_DEG", 0);
  if (rfViewScale < 0.5 || rfViewScale > 5 || rfViewRotation < -90 || rfViewRotation > 90)
    throw new Error("VITE_CASE1_RF_VIEW_*");
  const rf = {
    x0,
    y0,
    x1,
    y1,
    rangeWidth: x1 - x0,
    rangeHeight: y1 - y0,
    cell,
    gap,
    period: cell + gap,
    alpha,
    cdfPointCap: 256,
    invalidRgba: {
      r: channel("VITE_CASE1_HEATMAP_INVALID_R", 255),
      g: channel("VITE_CASE1_HEATMAP_INVALID_G", 255),
      b: channel("VITE_CASE1_HEATMAP_INVALID_B", 255),
      a: channel("VITE_CASE1_HEATMAP_INVALID_A", 0),
    },
  };
  return {
    geometry: model("GEOMETRY"),
    material: model("MATERIAL"),
    debug: bool("VITE_CASE1_DEBUG"),
    rfViewDebug: bool("VITE_CASE1_RF_VIEW_DEBUG"),
    rfView: {
      scale: rfViewScale,
      rotation: rfViewRotation,
      offsetX: num("VITE_CASE1_RF_VIEW_OFFSET_X", 0),
      offsetY: num("VITE_CASE1_RF_VIEW_OFFSET_Y", 0),
    },
    rf,
  };
}
