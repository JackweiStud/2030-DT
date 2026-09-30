import { describe, expect, it } from "vitest";
import { case4OverlayInput } from "../../src/cases/case4/components/map/threeOverlay";
import { loadCase4RuntimeConfig } from "../../src/cases/case4/config/case4RuntimeConfig";
import { loadCase3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import { loadCase3ThreeConfig } from "../../src/cases/shared/three/config";
const config = loadCase4RuntimeConfig({ CASE4_REFLECTION_ENABLE: "true", CASE4_BS_XYZ: "(1,2,3)", VITE_DT_3D_BS_XYZ: "(-2,-29,27)" });
const point = { no: 1, traditional: {x:1,y:2,z:3}, commercial: {x:2,y:3,z:4}, dt: {x:3,y:4,z:5}, reflection: { state: "ready" as const, los: true, points: [{id:2,x:4,y:5,z:6},{id:4,x:7,y:8,z:9}] } };
describe("case4 3D business adapter and shared configuration", () => {
 it("keeps three actual XYZ tracks, base UE and independently directed multiple paths", () => {
  const base = [{no:1,x:0,y:0,z:1}];
  const input = case4OverlayInput({config, baseRoute:base, livePoints:[point], playback:"running"});
  expect(input.ue).toEqual(base[0]);
  expect(input.tracks?.map(t=>t.points[0])).toEqual([point.traditional,point.commercial,point.dt]);
  expect(input.paths).toHaveLength(3);
  for(const path of input.paths) { expect(path.points[0]).toEqual(point.dt); expect(path.points.at(-1)).toEqual({x:-2,y:-29,z:27}); }
  expect(input.paths.slice(1).map(p=>p.ri?.id)).toEqual([2,4]);
 });
 it("clears invalid/missing reflection while retaining all three tracks", () => {
  for(const state of ["invalid","missing"] as const) {
   const input=case4OverlayInput({config, baseRoute:[], livePoints:[{...point,reflection:{state,los:null,points:[]}}],playback:"static"});
   expect(input.paths).toEqual([]); expect(input.bs).toBeUndefined(); expect(input.tracks).toHaveLength(3);
  }
 });
 it("new keys override legacy including explicit empty BS and invalid camera", () => {
  const env={VITE_DT_3D_BS_XYZ:"",VITE_CASE3_3D_BS_XYZ:"(9,9,9)",CASE4_REFLECTION_ENABLE:"true",CASE4_BS_XYZ:"(1,2,3)",CASE3_REFLECTION_ENABLE:"true",CASE3_BS_XYZ:"(4,5,6)"};
  expect(loadCase4RuntimeConfig(env).bsXyz3d).toBeUndefined();
  expect(loadCase3RuntimeConfig(env).bsXyz3d).toBeUndefined();
  expect(loadCase4RuntimeConfig(env).bsXyz).toEqual({x:1,y:2,z:3});
  expect(loadCase3RuntimeConfig(env).bsXyz).toEqual({x:4,y:5,z:6});
  expect(loadCase3ThreeConfig({VITE_CASE3_3D_CAMERA_ZOOM:"bad",VITE_DT_3D_CAMERA_ZOOM:"1"}).error).toBeTruthy();
  expect(loadCase3ThreeConfig({VITE_CASE3_3D_CAMERA_ZOOM:"2"}).zoom).toBe(2);
 });
});

it("separates camera/debug while retaining shared scene configuration", () => {
 const env={VITE_CASE3_3D_CAMERA_ZOOM:"2",VITE_CASE4_3D_CAMERA_ZOOM:"3",VITE_CASE3_3D_DEBUG_INFO:"1",VITE_CASE4_3D_DEBUG_INFO:"0",VITE_DT_3D_CAMERA_ZOOM:"4",VITE_DT_3D_PAN_SPEED:"5",VITE_DT_3D_BACKGROUND_COLOR:"#123456"};
 const a=loadCase3ThreeConfig(env), b=loadCase3ThreeConfig(env,"case4");
 expect([a.zoom,b.zoom,a.debug,b.debug]).toEqual([2,3,true,false]);
 expect([a.panSpeed,b.panSpeed,a.background,b.background]).toEqual([5,5,"#123456","#123456"]);
 expect(loadCase3ThreeConfig({VITE_CASE3_3D_CAMERA_ZOOM:"2"},"case4").zoom).toBe(1);
});
