import * as T from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { REFLECTION_WAVE, reflectionWavePhase } from "../reflectionGeometry";
import { businessToModel } from "./config";
export type XYZ = { x: number; y: number; z: number };
export type OverlayImages = { idle: HTMLImageElement; lit: HTMLImageElement; ue: HTMLImageElement };
export async function loadImages(urls: string[]): Promise<OverlayImages> {
  const images = await Promise.all(urls.map(async url => { const img = new Image(); img.src = url; await img.decode(); return img; }));
  return { idle: images[0]!, lit: images[1]!, ue: images[2]! };
}
export type OverlayInput = {
  baseRoute: Array<XYZ & { no: number }>; completed: number[]; walked: XYZ[]; ue?: XYZ;
  tracks?: Array<{ color: number; points: XYZ[] }>;
  bs?: XYZ; paths: Array<{ los: boolean; points: XYZ[]; ri?: { id: number; point: XYZ } }>;
  running: boolean;
};
/** Shared 2D artwork and pixel dimensions, attached to real 3D anchors. */
export function createOverlay(input: OverlayInput, images: OverlayImages) {
  const group = new T.Group();
  const sprites: Array<{ sprite: T.Sprite; width: number; height: number }> = [];
  const lines: Line2[] = [];
  const vec = (p: { x: number; y: number; z: number }) => new T.Vector3(...businessToModel(p));
  function line(points: T.Vector3[], color: number, width: number, opacity = 1, order = 1) {
    const material = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, depthWrite: false, depthTest: true });
    const result = new Line2(new LineGeometry(), material);
    result.geometry.setPositions(points.flatMap(p => p.toArray())); result.renderOrder = order;
    group.add(result); lines.push(result); return result;
  }
  function artwork(position: T.Vector3, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, anchor = [0.5, 0.5], order = 5) {
    const canvas = document.createElement("canvas"); canvas.width = width * 3; canvas.height = height * 3;
    const ctx = canvas.getContext("2d")!; ctx.scale(3, 3); paint(ctx);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
    sprite.center.set(anchor[0]!, anchor[1]!); sprite.position.copy(position); sprite.renderOrder = order;
    sprites.push({ sprite, width, height }); group.add(sprite);
  }
  function contained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  function text(position: T.Vector3, value: string, offsetX = 8, offsetY = 8) {
    const width = Math.max(32, value.length * 9 + offsetX), height = 30;
    artwork(position, width, height, ctx => {
      ctx.font = "700 12px sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(15,23,42,.7)"; ctx.strokeText(value, offsetX, 14);
      ctx.fillStyle = "#e0f2fe"; ctx.fillText(value, offsetX, 14);
    }, [0, 1 - (14 + offsetY) / height], 7);
  }
  const base = input.baseRoute.map(vec);
  if (base.length > 1) { line(base, 0xabc5ff, 14, 0.5); line(base, 0x457ef9, 9, 0.5, 2); }
  const completed = new Set(input.completed);
  const walked = input.walked.map(vec);
  if (walked.length > 1) { line(walked, 0xabc5ff, 14, 1, 3); line(walked, 0x457ef9, 9, 1, 4); }
  for (const p of input.baseRoute) {
    artwork(vec(p), 35, 30, ctx => {
      contained(ctx, completed.has(p.no) ? images.lit : images.idle, 35, 30);
      ctx.fillStyle = "white"; ctx.font = "400 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(p.no), 17.5, 11);
    }, [17.33132530120482 / 35, 1 - 26.897590361445785 / 30]);
  }
  if (input.ue) artwork(vec(input.ue), 36, 38, ctx => contained(ctx, images.ue, 36, 38), [0.5, 0], 8);
  for (const track of input.tracks ?? []) {
    if (track.points.length < 2) continue;
    line(track.points.map(vec), track.color, 2);
    for (const p of track.points) artwork(vec(p), 10, 10, ctx => {
      ctx.beginPath(); ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fillStyle = `#${track.color.toString(16).padStart(6, "0")}`; ctx.fill();
    });
  }
  const waves: Array<{ wave: Line2; beam?: Line2; path: T.Vector3[]; phase: number; waveLength: number }> = [];
  if (input.bs) {
    const bs = vec(input.bs);
    // 气泡尖端保持在真实 BS 坐标，文字与气泡共同面向相机。
    artwork(bs, 52, 36, ctx => {
      ctx.beginPath(); ctx.moveTo(9, 1); ctx.lineTo(43, 1);
      ctx.quadraticCurveTo(51, 1, 51, 9); ctx.lineTo(51, 19);
      ctx.quadraticCurveTo(51, 27, 43, 27); ctx.lineTo(32, 27);
      ctx.lineTo(26, 35); ctx.lineTo(20, 27); ctx.lineTo(9, 27);
      ctx.quadraticCurveTo(1, 27, 1, 19); ctx.lineTo(1, 9);
      ctx.quadraticCurveTo(1, 1, 9, 1); ctx.closePath();
      ctx.fillStyle = "#0284c7"; ctx.fill();
      ctx.strokeStyle = "#bae6fd"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.font = "700 14px sans-serif"; ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("基站", 26, 14);
    }, [0.5, 1 - 35 / 36], 7);
  }
  for (const [pathIndex, entry] of input.paths.entries()) {
    const path = entry.points.map(vec);
    const wave = line(path, entry.los ? 0x22c55e : 0xffffff, 2.2, 1, 9);
    wave.material.vertexColors = !entry.los;
    if (entry.los) text(path[0]!.clone().lerp(path.at(-1)!, 0.5), "LOS", 0, 18);
    if (entry.ri) {
      const point = vec(entry.ri.point);
      artwork(point, 12, 12, ctx => { ctx.beginPath(); ctx.arc(6,6,5,0,Math.PI*2);ctx.fillStyle="#c084fc";ctx.fill();ctx.strokeStyle="#f5d0fe";ctx.lineWidth=1.2;ctx.stroke(); });
      text(point, `NLOS R${entry.ri.id}`);
    }
    const beam = input.running ? line(path, 0xf8fafc, 2, 1, 10) : undefined;
    if (beam) beam.material.dashed = true;
    waves.push({ wave, beam, path, phase: reflectionWavePhase(pathIndex), waveLength: 1 });
  }
  let previousProjection = "";
  function update(camera: T.PerspectiveCamera, width: number, height: number, time: number) {
    camera.updateMatrixWorld();
    const pixelScale = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / (height * camera.zoom);
    for (const {sprite, width:w, height:h} of sprites) {
      const depth = -sprite.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
      sprite.visible = depth > camera.near;
      sprite.scale.set(w * depth * pixelScale, h * depth * pixelScale, 1);
    }
    for (const l of lines) l.material.resolution.set(width, height);
    if (!waves.length) return;
    const signature = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements, width, height].join(",");
    const changed = signature !== previousProjection;
    previousProjection = signature;
    for (const item of waves) {
      const { wave, beam, path } = item;
      let waveLength = item.waveLength;
    if (changed) {
      const positions: number[] = [], colors: number[] = [];
      const startColor = new T.Color(0xc084fc), endColor = new T.Color(0x22d3ee);
      const cameraRight = new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0), cameraUp = new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      const depths = path.map(p => -p.clone().applyMatrix4(camera.matrixWorldInverse).z);
      // Avoid explosive wave geometry when an endpoint crosses the near plane.
      const safe = depths.every(d => d > camera.near);
      const lengths = path.slice(1).map((p,i) => p.distanceTo(path[i]!));
      const total = lengths.reduce((a,b)=>a+b,0); let travelled=0, pixelTravelled=0;
      for (let s=0;s<path.length-1;s++) {
        const a=path[s]!, b=path[s+1]!;
        const pa=a.clone().project(camera), pb=b.clone().project(camera);
        const dx=(pb.x-pa.x)*width/2, dy=(pb.y-pa.y)*height/2;
        const pixels=safe && Number.isFinite(dx) && Number.isFinite(dy)?Math.hypot(dx,dy):0;
        const steps=Math.max(1,Math.min(2048,Math.ceil(pixels/REFLECTION_WAVE.stepPx)));
        const normal=pixels>0?cameraRight.clone().multiplyScalar(-dy).addScaledVector(cameraUp,dx).normalize():new T.Vector3();
        for(let i=s?1:0;i<=steps;i++) {
          const t=i/steps, p=a.clone().lerp(b,t), distance=pixels*t;
          const taper=Math.max(0,Math.min(1,distance/REFLECTION_WAVE.fadePx,(pixels-distance)/REFLECTION_WAVE.fadePx));
          const fade=taper*taper*(3-2*taper);
          const depth=-p.clone().applyMatrix4(camera.matrixWorldInverse).z;
          const amount=safe?Math.sin((pixelTravelled+distance)/REFLECTION_WAVE.wavelengthPx*Math.PI*2+item.phase)*REFLECTION_WAVE.amplitudePx*Math.max(0,fade)*depth*pixelScale:0;
          p.addScaledVector(normal,amount); positions.push(...p.toArray());
          colors.push(...startColor.clone().lerp(endColor,total?(travelled+lengths[s]!*t)/total:0).toArray());
        }
        travelled+=lengths[s]!; pixelTravelled+=pixels;
      }
      wave.geometry.dispose(); wave.geometry=new LineGeometry();wave.geometry.setPositions(positions);wave.geometry.setColors(colors); wave.computeLineDistances();
      if (beam) {
        beam.geometry.dispose();beam.geometry=new LineGeometry();beam.geometry.setPositions(positions);beam.computeLineDistances();
        waveLength=0; for(let i=3;i<positions.length;i+=3) waveLength+=Math.hypot(positions[i]!-positions[i-3]!,positions[i+1]!-positions[i-2]!,positions[i+2]!-positions[i-1]!);
        beam.material.dashSize=Math.max(0.0001,waveLength*.13);beam.material.gapSize=Math.max(0.0001,waveLength*.93);
      }
    }
    item.waveLength = waveLength;
    if (beam) beam.material.dashOffset=-(time%1200)/1200*waveLength;
    }
  }
  return { group, update, animated: input.running && waves.length > 0 };
}
