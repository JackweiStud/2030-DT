import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Case3RuntimeConfig } from "../../../case3/config/case3RuntimeConfig";
import { formatThreeEnv, loadCase3ThreeConfig } from "../../../case3/config/case3ThreeConfig";
import type { BaseRoutePoint, Case3Point } from "../../../case3/types";
import type { MapRendererHandle } from "../../../case3/hooks/useCase3Controller";
import { createThreeOverlay, loadOverlayImages } from "./threeOverlay";

type Props = {
  config: Case3RuntimeConfig; active: boolean; baseRoute: BaseRoutePoint[];
  points: Case3Point[]; currentPoint: Case3Point | null;
  reflectionVisible: boolean; reflectionPlayback: "running" | "static";
};
type Runtime = { draw: () => void; rebuild: () => void; reset: () => void; controls: OrbitControls };
function disposeTree(root: T.Object3D) {
  const resources = new Set<{ dispose(): void }>();
  root.traverse(n => {
    const obj = n as T.Mesh;
    if (obj.geometry) resources.add(obj.geometry);
    if (obj.material) for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      resources.add(mat);
      for (const value of Object.values(mat)) if ((value as T.Texture)?.isTexture) resources.add(value as T.Texture);
    }
  });
  resources.forEach(r => r.dispose());
}
export const MapRenderer3D = forwardRef<MapRendererHandle, Props>(function MapRenderer3D(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const runtime = useRef<Runtime | null>(null);
  const failure = useRef("");
  const capture = useRef(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [debugText, setDebugText] = useState("");
  const [copied, setCopied] = useState("");
  const config = props.config.three ?? loadCase3ThreeConfig({});
  useImperativeHandle(ref, () => ({
    resetView() { runtime.current?.reset(); },
    async prepareCapture() {
      if (!runtime.current || failure.current) throw new Error(failure.current || "Case3 3D 模型尚未就绪");
      capture.current = true;
      runtime.current.controls.enabled = false;
      runtime.current.draw();
    },
    finishCapture() {
      capture.current = false;
      if (runtime.current) { runtime.current.controls.enabled = latest.current.active; runtime.current.rebuild(); }
    },
  }), []);
  useEffect(() => {
    runtime.current?.rebuild();
  }, [props.baseRoute, props.points, props.currentPoint, props.reflectionVisible, props.reflectionPlayback]);
  useEffect(() => {
    if (runtime.current) { runtime.current.controls.enabled = props.active && !capture.current; runtime.current.draw(); }
  }, [props.active]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const abort = new AbortController();
    let destroyed = false, frame = 0;
    let cleanup = () => {};
    failure.current = ""; setError(""); setReady(false);
    const fail = (message: string) => { failure.current = message; setError(message); };
    async function start() {
      // StrictMode's disposable first mount must not start a second large download.
      await Promise.resolve();
      if (destroyed) return;
      if (config.error) throw new Error(config.error);
      const response = await fetch("/api/case3/models/geometry", { signal: abort.signal });
      if (!response.ok) throw new Error("Case3 3D 模型读取失败");
      const bytes = await response.arrayBuffer();
      if (destroyed) return;
      const gltf = await new GLTFLoader().parseAsync(bytes, "");
      if (destroyed) { disposeTree(gltf.scene); return; }
      const model = gltf.scene;
      cleanup = () => disposeTree(model);
      const overlayImages = await loadOverlayImages();
      if (destroyed) { disposeTree(model); return; }
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      cleanup = () => { disposeTree(model); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(config.background);
      renderer.domElement.setAttribute("aria-label", "Case3 3D 场景");
      element!.appendChild(renderer.domElement);
      const scene = new T.Scene(); scene.add(model);
      scene.add(new T.HemisphereLight(0xffffff, 0x637586, 2.5));
      const light = new T.DirectionalLight(0xffffff, 3); light.position.set(60, 120, 50); scene.add(light);
      const bounds = new T.Box3().setFromObject(model);
      const radius = bounds.getSize(new T.Vector3()).length() / 2;
      if (!Number.isFinite(radius) || radius <= 0) throw new Error("Case3 模型边界为空");
      const aspect = (element!.clientWidth || 1920) / (element!.clientHeight || 782);
      const camera = new T.PerspectiveCamera(40, aspect, 0.05, Math.max(10000, radius * 100));
      const target = config.target ? new T.Vector3(...config.target) : bounds.getCenter(new T.Vector3());
      const backward = new T.Vector3(1, 0.85, 1).normalize();
      const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), backward).normalize();
      const up = new T.Vector3().crossVectors(backward, right);
      const tangent = Math.tan(T.MathUtils.degToRad(20));
      let fitDistance = 1;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new T.Vector3(x, y, z).sub(target);
        fitDistance = Math.max(fitDistance, corner.dot(backward) + Math.max(Math.abs(corner.dot(up)) / tangent, Math.abs(corner.dot(right)) / (tangent * aspect)));
      }
      const initialPosition = config.position ? new T.Vector3(...config.position) : target.clone().add(backward.multiplyScalar(fitDistance * 1.08));
      camera.position.copy(initialPosition); camera.zoom = config.zoom;
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target); controls.maxPolarAngle = Math.PI / 2 - 0.01;
      controls.minDistance = 0.5; controls.maxDistance = Math.max(1000, radius * 20);
      controls.panSpeed = config.panSpeed; controls.rotateSpeed = config.rotateSpeed; controls.zoomSpeed = config.zoomSpeed;
      controls.enabled = latest.current.active; controls.update();
      const syncGestureScale = () => {
        const logicalHeight = renderer.domElement.clientHeight;
        const visibleHeight = renderer.domElement.getBoundingClientRect().height;
        const ratio = logicalHeight && visibleHeight ? visibleHeight / logicalHeight : 1;
        controls.panSpeed = config.panSpeed / ratio;
        controls.rotateSpeed = config.rotateSpeed / ratio;
      };
      renderer.domElement.addEventListener("pointerdown", syncGestureScale, true);
      const initialCamera = camera.position.clone(), initialTarget = controls.target.clone();
      let overlay = createThreeOverlay(latest.current, overlayImages); scene.add(overlay.group);
      // Bias only the model depth buffer, keeping actual business positions unchanged.
      model.traverse(node => {
        const mesh = node as T.Mesh;
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          material.polygonOffset = true; material.polygonOffsetFactor = 1; material.polygonOffsetUnits = 1;
        }
      });
      function draw() {
        if (destroyed || !latest.current.active || failure.current) return;
        const width = element!.clientWidth, height = element!.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); overlay.update(camera, width, height, performance.now()); renderer.render(scene, camera);
        if (config.debug) setDebugText(formatThreeEnv(config, camera.position.toArray(), controls.target.toArray(), camera.zoom));
      }
      function rebuild() {
        if (capture.current || destroyed) return;
        cancelAnimationFrame(frame);
        disposeTree(overlay.group); scene.remove(overlay.group);
        overlay = createThreeOverlay(latest.current, overlayImages); scene.add(overlay.group);
        draw(); schedule();
      }
      function schedule() {
        cancelAnimationFrame(frame);
        if (!latest.current.active || !overlay.animated || capture.current || destroyed) return;
        frame = requestAnimationFrame(() => { draw(); schedule(); });
      }
      const change = () => { draw(); };
      controls.addEventListener("change", change);
      const observer = new ResizeObserver(() => { draw(); schedule(); }); observer.observe(element!);
      const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); fail("3D 显示上下文丢失，请重试或返回 2D"); };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      runtime.current = { controls, draw: () => { draw(); schedule(); }, rebuild, reset: () => { if (capture.current) return; camera.position.copy(initialCamera); camera.zoom = config.zoom; controls.target.copy(initialTarget); controls.update(); draw(); } };
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", syncGestureScale, true); controls.removeEventListener("change", change); controls.dispose();
        renderer.domElement.removeEventListener("webglcontextlost", lost); disposeTree(overlay.group); disposeTree(model); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
      rebuild(); setReady(true);
    }
    void start().catch(e => { cleanup(); cleanup = () => {}; runtime.current = null; if (!destroyed) fail(e instanceof Error ? e.message : String(e)); });
    return () => { destroyed = true; abort.abort(); runtime.current = null; cleanup(); };
  }, [props.config.three, retry]);
  return <div className="case3v2-three" data-testid="case3-3d" data-ready={ready && !error ? "true" : "false"}>
    <div className="case3v2-three-canvas" ref={host} />
    {(!ready || error) && <div className="case3v2-three-status" role={error ? "alert" : "status"}>{error || "正在加载 Case3 3D 模型…"}{error && <button onClick={() => setRetry(n => n + 1)}>重试</button>}</div>}
    {ready && !error && <button className="case3v2-three-reset" data-case3-capture-exclude onClick={() => runtime.current?.reset()}>复位3D视角</button>}
    {config.debug && ready && !error && <aside className="case3v2-three-debug" data-case3-capture-exclude>
      <strong>Case3 3D debug info</strong><p>业务 (x,y,z) → 模型 (x,z,-y)，单位：米</p>
      <textarea aria-label="Case3 3D 视角参数" readOnly value={debugText} />
      <button onClick={() => { if (!navigator.clipboard) { setCopied("请选中文本手工复制"); return; } void navigator.clipboard.writeText(debugText).then(() => setCopied("已复制，请替换 Web .env 对应参数并重启或重新构建")).catch(() => setCopied("请选中文本手工复制")); }}>复制参数</button><span role="status">{copied}</span>
    </aside>}
  </div>;
});
