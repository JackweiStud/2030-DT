// Frontend-isolated browser QA with real case3 GLB and mocked business data.
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const output = new URL("../test-results/case3-3d/", import.meta.url);
await mkdir(output, { recursive: true });
const model = await readFile(new URL("../assets/case1/3D/Beijing_Geometry.glb", import.meta.url));
const baseRoute = (await readFile(new URL("../../comdatafiles/case3/ue_comm_coordinates_base.txt", import.meta.url), "utf8")).trim().split(/\r?\n/).filter(s => s.trim()).map((s, i) => { const [x,y,z] = s.split(",").map(Number); return { no:i+1,x,y,z }; });
const browser = await chromium.launch({ channel:"chrome", headless:true, args:["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport:{width:1920,height:1080}, permissions:["clipboard-read","clipboard-write"] });
  const errors=[]; page.on("pageerror", e => errors.push(e.stack || e.message));
  let control={case:"case3",command:"init",dt_type:"",status:"",save_picture_flag:0};
  let polls=0, modelRequests=0, shots=0, failModel=false;
  const snapshot = side => ({ok:true,side,points:baseRoute.map(p => ({no:p.no,ue:{x:p.x,y:p.y,z:p.z},selectedBeamId:10,scanBeamIds:[0,10],reflection:{x:0,y:4,z:2,los:false}})),completeCount:baseRoute.length,pendingTail:false,costPct:side==="with"?12.5:25});
  await page.route("**/api/**", async route => {
    const url=new URL(route.request().url()); if (!url.pathname.startsWith("/api/")) return route.continue(); const post=route.request().method()==="POST";
    const send = body => route.fulfill({json:body});
    if (url.pathname === "/api/case3/models/geometry") { modelRequests++; return route.fulfill({status:failModel?404:200,contentType:"model/gltf-binary",body:failModel?Buffer.from(""):model}); }
    if (!url.pathname.startsWith("/api/case3/")) return route.fulfill({status:404,json:{ok:false}});
    if (url.pathname.endsWith("/control-file")) {
      if(post){ const p=route.request().postDataJSON(); control={...control,...p}; if(p.command==="start"){polls=0;control.status="";} if(p.command==="init"){control.status="";control.save_picture_flag=0;} }
      else if(control.command==="start"){polls++;control.status=polls<6?"execute success":"case complete"; if(polls===6)control.save_picture_flag=1;}
      return send({ok:true,control});
    }
    if(url.pathname.endsWith("/init-data"))return send({ok:true,baseRoute,beamAccuracyBaseline:{success:80,total:100}});
    if(url.pathname.endsWith("/side"))return send(snapshot(url.searchParams.get("side")));
    if(url.pathname.endsWith("/throughput"))return send({ok:true,side:url.searchParams.get("side"),samples:baseRoute.map(p=>({no:p.no,gbps:1})),pendingTail:false});
    if(url.pathname.endsWith("/screenshot")){ const payload=route.request().postDataJSON(); const data=payload.image_base64; assert.equal(typeof data,"string",JSON.stringify(Object.keys(payload))); await writeFile(new URL(`business-${shots}.png`,output),Buffer.from(data.replace(/^data:.*;base64,/,""),"base64"));shots++;control.save_picture_flag=0;return send({ok:true,path:`out/case3/qa-${shots}.png`,seq:shots}); }
    return route.fulfill({status:404,json:{ok:false}});
  });
  await page.goto(process.env.CASE3_QA_URL || "http://127.0.0.1:5186");
  await page.getByRole("button",{name:"DT辅助通信",exact:true}).click();
  await expect(page.getByTitle("启动无 DT")).toBeEnabled();
  await page.getByRole("button",{name:"3D视图",exact:true}).click();
  await expect(page.getByTestId("case3-3d")).toHaveAttribute("data-ready","true",{timeout:60000});
  const debug=page.getByLabel("Case3 3D 视角参数"); await expect(debug).toHaveValue(/CAMERA_POSITION/);
  const initial=await debug.inputValue(); await page.getByRole("button",{name:"复制参数",exact:true}).click(); assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,"\n"),initial);
  await page.mouse.move(1250,450); await page.mouse.down(); await page.mouse.move(1350,490,{steps:8}); await page.mouse.up();
  await expect(debug).not.toHaveValue(initial); const rotated=await debug.inputValue();
  await page.getByRole("button",{name:"2D视图",exact:true}).click(); await page.getByRole("button",{name:"3D视图",exact:true}).click();
  assert.equal(await debug.inputValue(),rotated); assert.equal(modelRequests,1);
  await page.getByRole("button",{name:"复位3D视角"}).click(); await expect(debug).toHaveValue(initial);
  await page.screenshot({path:new URL("initial.png",output).pathname.replace(/^\/([A-Za-z]:)/,"$1")});
  await page.getByTitle("启动无 DT").click(); await expect.poll(()=>shots,{timeout:60000}).toBe(1);
  await expect(page.getByTitle("启动有 DT")).toBeEnabled({timeout:10000});
  await page.getByTitle("启动有 DT").click(); await expect.poll(()=>shots,{timeout:60000}).toBe(2);
  await expect(page.getByTestId("case3-v2-page")).toHaveAttribute("data-state","with-completed");
  await page.screenshot({path:new URL("completed.png",output).pathname.replace(/^\/([A-Za-z]:)/,"$1")});
  await page.mouse.move(1100,400); await page.mouse.wheel(0,-1800); await page.waitForTimeout(250); await page.screenshot({path:new URL("completed-closeup.png",output).pathname.replace(/^\/([A-Za-z]:)/,"$1")});
  await page.setViewportSize({width:1280,height:720}); await page.mouse.move(800,320); await page.mouse.wheel(0,-200); await expect(debug).not.toHaveValue(initial);
  const beforePan=await debug.inputValue(); await page.mouse.move(800,320); await page.mouse.down({button:"right"}); await page.mouse.move(850,340,{steps:6}); await page.mouse.up({button:"right"}); await expect(debug).not.toHaveValue(beforePan); await page.getByRole("button",{name:"DT构建",exact:true}).click();
  await expect(page.getByTestId("case3-3d")).toHaveCount(0);
  failModel=true; await page.getByRole("button",{name:"DT辅助通信",exact:true}).click(); await page.getByRole("button",{name:"3D视图",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("模型读取失败");
  failModel=false; await page.getByRole("button",{name:"重试",exact:true}).click(); await expect(page.getByTestId("case3-3d")).toHaveAttribute("data-ready","true",{timeout:60000});
  assert.deepEqual(errors,[]); console.log(JSON.stringify({ok:true,modelRequests,shots,errors,output:output.href}));
} finally { await browser.close(); }

