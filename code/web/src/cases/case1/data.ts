import { useEffect, useRef, useState } from "react";
export type Layer = "geometry" | "material" | "rf";
export type View = Layer | "home";
export type Kpi = { id: string; off: number; on: number };
export type LayerData = { kpis: Kpi[]; matrix?: number[][] };
export function useLayerData(view: View) {
  const [data, setData] = useState<Partial<Record<Layer, LayerData>>>({});
  const [errors, setErrors] = useState<Partial<Record<Layer, string>>>({});
  const cache = useRef<Partial<Record<Layer, LayerData>>>({});
  useEffect(() => {
    if (view === "home" || cache.current[view]) return;
    const controller = new AbortController();
    setErrors((e) => ({ ...e, [view]: undefined }));
    void fetch(`/api/case1/data/${view}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok)
          throw new Error(json.error?.message || "离线数据读取失败");
        return json as LayerData;
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        cache.current[view] = value;
        setData((d) => ({ ...d, [view]: value }));
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setErrors((old) => ({ ...old, [view]: String(e.message) }));
      });
    return () => controller.abort();
  }, [view]);
  return { data, errors };
}
export function kpiComparison(item: Kpi, ratio: boolean) {
  const top = ratio
    ? 1
    : Math.max(1, Math.ceil(Math.max(item.off, item.on) * 1.15 * 10) / 10);
  const delta =
    item.off === 0 || item.on === item.off
      ? null
      : ((item.on - item.off) / item.off) * 100;
  return { top, delta };
}
