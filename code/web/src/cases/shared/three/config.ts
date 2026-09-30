export type Triple = [number, number, number];
export type Case3ThreeConfig = {
  debug: boolean; position?: Triple; target?: Triple; zoom: number;
  panSpeed: number; rotateSpeed: number; zoomSpeed: number; background: string; error?: string;
};
export const CASE3_3D_DEFAULT_BACKGROUND = "#202832";
/** VITE_CASE3_3D_BACKGROUND_COLOR：#RRGGBB。dotenv 会把未加引号的 # 当成注释，因此 .env 必须写成 "#RRGGBB"；这里也接受带引号的副本。未配置或格式不对时退回默认色。Case1 几何层与电磁材质层共用这一项。 */
export function readCase3ThreeBackground(raw: string | undefined): string {
  let value = raw?.trim() ?? "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1).trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : CASE3_3D_DEFAULT_BACKGROUND;
}
export function loadCase3ThreeConfig(env: Record<string, string | undefined>, caseId: "case3" | "case4" = "case3"): Case3ThreeConfig {
  const original = env;
  env = normalizeThreeEnv(env);
  for (const suffix of ["DEBUG_INFO", "CAMERA_POSITION", "CAMERA_TARGET", "CAMERA_ZOOM"]) {
    const own = `VITE_${caseId.toUpperCase()}_3D_${suffix}`;
    const value = original[own] ?? original[`VITE_DT_3D_${suffix}`];
    if (value === undefined) delete env[`VITE_CASE3_3D_${suffix}`];
    else env[`VITE_CASE3_3D_${suffix}`] = value;
  }
  const defaults = { debug: false, zoom: 1, panSpeed: 1, rotateSpeed: 1, zoomSpeed: 1, background: readCase3ThreeBackground(env.VITE_CASE3_3D_BACKGROUND_COLOR) };
  const key = (s: string) => `VITE_CASE3_3D_${s}`;
  try {
    const raw = env[key("DEBUG_INFO")]?.trim().toLowerCase() || "false";
    if (!["true", "false", "0", "1"].includes(raw)) throw new Error(key("DEBUG_INFO"));
    const triple = (s: string): Triple | undefined => {
      const raw = env[key(s)]?.trim();
      if (!raw) return undefined;
      const parts = raw.split(",");
      if (parts.length !== 3 || parts.some(p => !p.trim() || !Number.isFinite(Number(p)))) throw new Error(key(s));
      return parts.map(Number) as Triple;
    };
    const positive = (s: string) => {
      const raw = env[key(s)];
      const value = raw === undefined ? 1 : Number(raw);
      if (!Number.isFinite(value) || value <= 0) throw new Error(key(s));
      return value;
    };
    const position = triple("CAMERA_POSITION"), target = triple("CAMERA_TARGET");
    if (!!position !== !!target || (position && target && position.every((v, i) => v === target[i]))) throw new Error("CAMERA_POSITION / CAMERA_TARGET 必须成对且不重合");
    return { debug: raw === "true" || raw === "1", position, target, zoom: positive("CAMERA_ZOOM"), panSpeed: positive("PAN_SPEED"), rotateSpeed: positive("ROTATE_SPEED"), zoomSpeed: positive("ZOOM_SPEED"), background: defaults.background };
  } catch (e) { return { ...defaults, error: `3D 配置错误：${(e as Error).message}` }; }
}
export function businessToModel(p: { x: number; y: number; z: number }): Triple { return [p.x, p.z, -p.y]; }
export function formatThreeEnv(c: Case3ThreeConfig, position: number[], target: number[], zoom: number, caseId: "case3" | "case4" = "case3") {
  const vector = (v: number[]) => v.map(n => Number(n.toFixed(9))).join(",");
  return [`DEBUG_INFO=${c.debug}`, `CAMERA_POSITION=${vector(position)}`, `CAMERA_TARGET=${vector(target)}`, `CAMERA_ZOOM=${zoom}`, `PAN_SPEED=${c.panSpeed}`, `ROTATE_SPEED=${c.rotateSpeed}`, `ZOOM_SPEED=${c.zoomSpeed}`, `BACKGROUND_COLOR="${c.background}"`].map((s, index) => `VITE_${index < 4 ? caseId.toUpperCase() : "DT"}_3D_${s}`).join("\n");
}

export function normalizeThreeEnv(env: Record<string, string | undefined>) {
  const result = { ...env };
  for (const suffix of ["DEBUG_INFO", "CAMERA_POSITION", "CAMERA_TARGET", "CAMERA_ZOOM", "PAN_SPEED", "ROTATE_SPEED", "ZOOM_SPEED", "BACKGROUND_COLOR", "BS_XYZ"]) {
    const key = `VITE_DT_3D_${suffix}`;
    if (env[key] !== undefined) result[`VITE_CASE3_3D_${suffix}`] = env[key];
  }
  return result;
}
