import { useEffect, useState } from "react";
import type { Group, Mesh, Texture, Material } from "three";
export type ModelLayer = "geometry" | "material";
export function disposeModel(root: Group) {
  const resources = new Set<{ dispose: () => void }>();
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    for (const mat of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      resources.add(mat);
      for (const value of Object.values(mat as Material))
        if ((value as Texture)?.isTexture) resources.add(value as Texture);
    }
  });
  resources.forEach((item) => item.dispose());
}
export function useModels() {
  const [models, setModels] = useState<Partial<Record<ModelLayer, Group>>>({});
  const [errors, setErrors] = useState<Partial<Record<ModelLayer, string>>>({});
  useEffect(() => {
    const abort = new AbortController();
    const owned: Group[] = [];
    let secondFrame = 0;
    // Two paint frames let home appear before importing/parsing the large models.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        void prepare();
      });
    });
    async function prepare() {
      for (const layer of ["geometry", "material"] as const) {
        if (abort.signal.aborted) return;
        try {
          const { GLTFLoader } = await import(
            "three/addons/loaders/GLTFLoader.js"
          );
          if (abort.signal.aborted) return;
          const res = await fetch(`/api/case1/models/${layer}`, {
            signal: abort.signal,
          });
          if (!res.ok) throw new Error("模型文件未配置或无法读取");
          const bytes = await res.arrayBuffer();
          if (abort.signal.aborted) return;
          const gltf = await new GLTFLoader().parseAsync(bytes, "");
          if (abort.signal.aborted) {
            disposeModel(gltf.scene);
            return;
          }
          owned.push(gltf.scene);
          setModels((old) => ({ ...old, [layer]: gltf.scene }));
        } catch (e) {
          if (!abort.signal.aborted)
            setErrors((old) => ({
              ...old,
              [layer]: e instanceof Error ? e.message : "模型加载失败",
            }));
        }
      }
    }
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      abort.abort();
      owned.forEach(disposeModel);
    };
  }, []);
  return { models, errors };
}
