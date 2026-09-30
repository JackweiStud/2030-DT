import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { formatThreeEnv, loadCase3ThreeConfig, type Case3ThreeConfig } from "./config";
import type { OverlayImages } from "./overlay";
import iconReset from "../../../../assets/case3-v2/icon-rotate-ccw.svg";
export type ThreeHandle = { resetView(): void; prepareCapture(): Promise<void>; finishCapture?(): void };
type Overlay = { group: T.Group; update(camera: T.PerspectiveCamera, width: number, height: number, time: number): void; animated: boolean };
type Props = { config?: Case3ThreeConfig; active: boolean; caseName: string; modelUrl: string; scope: string;
  loadImages: () => Promise<OverlayImages>; createOverlay: (images: OverlayImages) => Overlay };
const DEFAULT_CONFIG = loadCase3ThreeConfig({});
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
export const ThreeViewport = forwardRef<ThreeHandle, Props>(function ThreeViewport(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const runtime = useRef<Runtime | null>(null);
  const failure = useRef("");
  const capture = useRef(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [viewDirty, setViewDirty] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [copied, setCopied] = useState("");
  const config = props.config ?? DEFAULT_CONFIG;
  useImperativeHandle(ref, () => ({
    resetView() {
      runtime.current?.reset();
      setViewDirty(false);
    },
    async prepareCapture() {
      if (!runtime.current || failure.current) throw new Error(failure.current || `${props.caseName} 3D 模型尚未就绪`);
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
  }, [props.createOverlay]);
  useEffect(() => {
    if (runtime.current) { runtime.current.controls.enabled = props.active && !capture.current; runtime.current.draw(); }
  }, [props.active]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const abort = new AbortController();
    let destroyed = false, frame = 0;
    let cleanup = () => {};
    failure.current = ""; setError(""); setReady(false); setViewDirty(false);
    const fail = (message: string) => { failure.current = message; setError(message); };
    async function start() {
      // StrictMode's disposable first mount must not start a second large download.
      await Promise.resolve();
      if (destroyed) return;
      if (config.error) throw new Error(config.error);
      const response = await fetch(props.modelUrl, { signal: abort.signal });
      if (!response.ok) throw new Error(`${props.caseName} 3D 模型读取失败`);
      const bytes = await response.arrayBuffer();
      if (destroyed) return;
      const gltf = await new GLTFLoader().parseAsync(bytes, "");
      if (destroyed) { disposeTree(gltf.scene); return; }
      const model = gltf.scene;
      cleanup = () => disposeTree(model);
      const overlayImages = await props.loadImages();
      if (destroyed) { disposeTree(model); return; }
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      cleanup = () => { disposeTree(model); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.setClearColor(config.background);
      renderer.domElement.setAttribute("aria-label", `${props.caseName} 3D 场景`);
      element!.appendChild(renderer.domElement);
      const scene = new T.Scene(); scene.add(model);
      // Blender「材质预览」靠内置 HDRI；Web 侧用 RoomEnvironment IBL 近似，再加弱补光。
      const pmrem = new T.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const envTarget = pmrem.fromScene(room, 0.04);
      room.dispose();
      const envTexture = envTarget.texture;
      scene.environment = envTexture;
      scene.add(new T.HemisphereLight(0xffffff, 0x8a93a0, 0.45));
      const light = new T.DirectionalLight(0xfff2e0, 1.1); light.position.set(60, 120, 50); scene.add(light);
      cleanup = () => {
        scene.environment = null;
        envTarget.dispose();
        pmrem.dispose();
        disposeTree(model);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      const bounds = new T.Box3().setFromObject(model);
      const radius = bounds.getSize(new T.Vector3()).length() / 2;
      if (!Number.isFinite(radius) || radius <= 0) throw new Error(`${props.caseName} 模型边界为空`);
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
      let overlay = latest.current.createOverlay(overlayImages); scene.add(overlay.group);
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
        if (config.debug) setDebugText(formatThreeEnv(config, camera.position.toArray(), controls.target.toArray(), camera.zoom, props.scope === "c4" ? "case4" : "case3"));
      }
      function rebuild() {
        if (capture.current || destroyed) return;
        cancelAnimationFrame(frame);
        disposeTree(overlay.group); scene.remove(overlay.group);
        overlay = latest.current.createOverlay(overlayImages); scene.add(overlay.group);
        draw(); schedule();
      }
      function schedule() {
        cancelAnimationFrame(frame);
        if (!latest.current.active || !overlay.animated || capture.current || destroyed) return;
        frame = requestAnimationFrame(() => { draw(); schedule(); });
      }
      const change = () => { draw(); };
      const onUserStart = () => {
        if (destroyed || capture.current) return;
        setViewDirty(true);
      };
      controls.addEventListener("change", change);
      controls.addEventListener("start", onUserStart);
      const observer = new ResizeObserver(() => { draw(); schedule(); }); observer.observe(element!);
      const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); fail("3D 显示上下文丢失，请重试或返回 2D"); };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      runtime.current = {
        controls,
        draw: () => { draw(); schedule(); },
        rebuild,
        reset: () => {
          if (capture.current) return;
          camera.position.copy(initialCamera);
          camera.zoom = config.zoom;
          controls.target.copy(initialTarget);
          controls.update();
          draw();
          if (!destroyed) setViewDirty(false);
        },
      };
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", syncGestureScale, true);
        controls.removeEventListener("change", change); controls.removeEventListener("start", onUserStart); controls.dispose();
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        disposeTree(overlay.group); scene.remove(overlay.group);
        scene.environment = null; envTarget.dispose(); pmrem.dispose();
        disposeTree(model); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
      rebuild(); setReady(true);
    }
    void start().catch(e => { cleanup(); cleanup = () => {}; runtime.current = null; if (!destroyed) fail(e instanceof Error ? e.message : String(e)); });
    return () => { destroyed = true; abort.abort(); runtime.current = null; cleanup(); };
  }, [props.config, retry]);
  return <div className={`${props.scope}-three`} data-testid={`${props.scope === "c4" ? "case4" : "case3"}-3d`} data-ready={ready && !error ? "true" : "false"}>
    <div className={`${props.scope}-three-canvas`} ref={host} />
    {(!ready || error) && <div className={`${props.scope}-three-status`} role={error ? "alert" : "status"}>{error || "正在加载 3D 模型…"}{error && <button onClick={() => setRetry(n => n + 1)}>重试</button>}</div>}
    {ready && !error && viewDirty ? (
      <button
        type="button"
        className={`${props.scope}-map-reset`}
        aria-label="复位地图"
        data-case3-capture-exclude
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          runtime.current?.reset();
        }}
      >
        <img src={iconReset} alt="" width={16} height={16} draggable={false} />
      </button>
    ) : null}
    {config.debug && ready && !error && <aside className={`${props.scope}-three-debug`} data-case3-capture-exclude>
      <strong>{props.caseName} 3D debug info</strong><p>业务 (x,y,z) → 模型 (x,z,-y)，单位：米</p>
      <textarea aria-label={`${props.caseName} 3D 视角参数`} readOnly value={debugText} />
      <button onClick={() => { if (!navigator.clipboard) { setCopied("请选中文本手工复制"); return; } void navigator.clipboard.writeText(debugText).then(() => setCopied("已复制，请替换 Web .env 对应参数并重启或重新构建")).catch(() => setCopied("请选中文本手工复制")); }}>复制参数</button><span role="status">{copied}</span>
    </aside>}
  </div>;
});
