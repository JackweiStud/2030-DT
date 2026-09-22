import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { ModelConfig } from "./config";
import type { ModelLayer } from "./models";

export function ModelViewport({
  model,
  error,
  active,
  config,
  debug,
  layer,
}: {
  model?: Group;
  error?: string;
  active: boolean;
  config: ModelConfig;
  debug: boolean;
  layer: ModelLayer;
}) {
  const host = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const draw = useRef<() => void>(() => {});
  const [runtimeError, setRuntimeError] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (active) draw.current();
  }, [active]);
  useEffect(() => {
    const element = host.current;
    if (!model || !element) return;
    let cancelled = false;
    let cleanup = () => {};
    void (async () => {
      const T = await import("three");
      const { OrbitControls } = await import(
        "three/addons/controls/OrbitControls.js"
      );
      if (cancelled) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      cleanup = () => {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x1f2123, 1);
      element.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-label", `${layer} 3D 模型`);
      const scene = new T.Scene();
      const root = new T.Group();
      // Normalize bounds to a unit longest side; env uses model-size-independent coordinates.
      const box = new T.Box3().setFromObject(model);
      const size = box.getSize(new T.Vector3());
      const center = box.getCenter(new T.Vector3());
      const extent = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(extent) || extent <= 0) {
        throw new Error("模型边界为空");
      }
      const normalized = new T.Group();
      normalized.scale.setScalar(1 / extent);
      normalized.position.copy(center).multiplyScalar(-1 / extent);
      normalized.add(model);
      root.add(normalized);
      root.rotation.set(...config.rotation);
      root.scale.setScalar(config.scale);
      scene.add(root);
      scene.add(new T.HemisphereLight(0xffffff, 0x687382, 2.5));
      const light = new T.DirectionalLight(0xffffff, 3);
      light.position.set(2, 4, 3);
      scene.add(light);
      const camera = new T.PerspectiveCamera(40, 1, 0.001, 1000);
      camera.position.set(...config.position);
      camera.zoom = config.zoom;
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...config.target);
      controls.panSpeed = config.panSpeed;
      controls.rotateSpeed = config.rotateSpeed;
      controls.zoomSpeed = config.zoomSpeed;
      controls.minDistance = 0.01;
      controls.maxDistance = 100;
      controls.update();
      const fmt = (values: number[]) =>
        values.map((n) => Number(n.toFixed(6))).join(",");
      const render = () => {
        if (cancelled || !activeRef.current) return;
        const width = element.clientWidth,
          height = element.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        if (debug) {
          const p = `VITE_CASE1_${layer.toUpperCase()}_`;
          setText(
            `${p}CAMERA_POSITION=${fmt(camera.position.toArray())}\n${p}CAMERA_TARGET=${fmt(controls.target.toArray())}\n${p}CAMERA_ZOOM=${camera.zoom}\n${p}MODEL_ROTATION=${fmt([root.rotation.x, root.rotation.y, root.rotation.z])}\n${p}MODEL_SCALE=${root.scale.x}\n${p}PAN_SPEED=${controls.panSpeed}\n${p}ROTATE_SPEED=${controls.rotateSpeed}\n${p}ZOOM_SPEED=${controls.zoomSpeed}`,
          );
        }
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        setRuntimeError("3D 显示上下文丢失，请切换 case 后重试");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      controls.addEventListener("change", render);
      const observer = new ResizeObserver(render);
      observer.observe(element);
      draw.current = render;
      cleanup = () => {
        draw.current = () => {};
        observer.disconnect();
        controls.removeEventListener("change", render);
        controls.dispose();
        model.removeFromParent();
        renderer.domElement.removeEventListener(
          "webglcontextlost",
          contextLost,
        );
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      render();
    })().catch((e) => {
      cleanup();
      cleanup = () => {};
      if (!cancelled) setRuntimeError(String(e.message));
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [model, config, debug, layer]);
  return (
    <>
      <div className="c1-model" ref={host} />
      {(error || runtimeError || !model) && (
        <p
          className="c1-model-status"
          role={error || runtimeError ? "alert" : "status"}
        >
          {error || runtimeError || "正在准备 3D 模型…"}
        </p>
      )}
      {debug && model && (
        <aside className="c1-debug">
          <textarea aria-label={`${layer} 视角配置`} readOnly value={text} />
          <button
            type="button"
            onClick={() => {
              if (!navigator.clipboard) {
                setCopied("请选中文本手动复制");
                return;
              }
              void navigator.clipboard
                .writeText(text)
                .then(() => setCopied("已复制"))
                .catch(() => setCopied("请选中文本手动复制"));
            }}
          >
            复制配置
          </button>
          <span role="status">{copied}</span>
        </aside>
      )}
    </>
  );
}
