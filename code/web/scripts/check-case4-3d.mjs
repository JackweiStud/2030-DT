// Real GLB / isolated mock business API; never writes shared business files.
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=new URL('../test-results/case4-3d/',import.meta.url);await mkdir(output,{recursive:true});
const model=await readFile(new URL('../assets/case1/3D/Beijing_Geometry.glb',import.meta.url));
const baseRoute=(await readFile(new URL('../../comdatafiles/case4/ue_position_coordinates_base.txt',import.meta.url),'utf8')).trim().split(/\r?\n/).map((s,i)=>{const [x,y,z]=s.split(',').map(Number);return {no:i+1,x,y,z};});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let modelRequests=0,shots=0,polls=0,failModel=false,control={case:'case4',command:'init',dt_type:'',status:'',save_picture_flag:0};
 const trajectory={points:baseRoute.map(p=>({no:p.no,traditional:{x:p.x+1,y:p.y,z:p.z},commercial:{x:p.x,y:p.y+1,z:p.z},dt:p,reflection:{state:'ready',los:true,points:[{id:1,x:2,y:-10,z:15},{id:3,x:6,y:-20,z:20}]}})),completeCount:baseRoute.length,pendingTail:false};
 const throughput={samples:baseRoute.map(p=>({no:p.no,gbps:1})),pendingTail:false};const cdf=[{errorM:1,probability:1}],cep={p50M:1,p90M:2};
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(!url.pathname.startsWith('/api/'))return route.continue();const send=body=>route.fulfill({json:body});
 if(url.pathname==='/api/case4/models/geometry'){modelRequests++;return route.fulfill({status:failModel?404:200,contentType:'model/gltf-binary',body:failModel?Buffer.from(''):model});}
 if(url.pathname.endsWith('/control-file')){if(route.request().method()==='POST'){control={...control,...route.request().postDataJSON()};polls=0;control.status='';}else if(control.command==='start'){polls++;control.status=polls<5?'execute success':'case complete';if(polls===5)control.save_picture_flag=1;}return send({ok:true,control});}
 if(url.pathname.endsWith('/init-data'))return send({ok:true,baseRoute});
 if(url.pathname.endsWith('/trajectory'))return send({ok:true,...trajectory});
 if(url.pathname.endsWith('/throughput'))return send({ok:true,...throughput,side:url.searchParams.get('side')});
 if(url.pathname.endsWith('/result'))return send({ok:true,trajectory,throughput:{without:throughput,with:throughput},statistics:{cdf:{traditional:cdf,commercial:cdf,dt:cdf},cep:{traditional:cep,commercial:cep,dt:cep},nlosRatio:0.2}});
 if(url.pathname.endsWith('/screenshot')){await writeFile(new URL('business.png',output),Buffer.from(route.request().postDataJSON().image_base64.replace(/^data:.*;base64,/,''),'base64'));shots++;control.save_picture_flag=0;return send({ok:true,path:'out/case4/qa.png',seq:0});}
 return route.fulfill({status:404,json:{ok:false}});
 });
 await page.goto(process.env.CASE4_QA_URL||'http://127.0.0.1:5186');await page.getByRole('button',{name:'DT辅助定位',exact:true}).click();
 await expect.poll(()=>modelRequests).toBe(1);await expect(page.getByRole('button',{name:'2D视图',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('case4-3d')).toHaveAttribute('data-ready','true',{timeout:60000});
 await page.getByRole('button',{name:'3D视图',exact:true}).click();const debug=page.getByLabel('Case4 3D 视角参数');const initial=await debug.inputValue();
 await page.mouse.move(1100,450);await page.mouse.down();await page.mouse.move(1200,480,{steps:8});await page.mouse.up();await expect(debug).not.toHaveValue(initial);const changed=await debug.inputValue();
 await page.getByRole('button',{name:'2D视图',exact:true}).click();await page.getByRole('button',{name:'3D视图',exact:true}).click();assert.equal(await debug.inputValue(),changed);assert.equal(modelRequests,1);
 await page.getByRole('button',{name:'复位地图'}).click();await expect(debug).toHaveValue(initial);
 await page.getByRole('button',{name:'开始',exact:true}).click();await expect.poll(()=>shots,{timeout:60000}).toBe(1);await expect(page.getByText('已完成',{exact:true})).toBeVisible();
 await page.screenshot({path:new URL('completed.png',output).pathname});
 await page.setViewportSize({width:1280,height:720});const beforePan=await debug.inputValue();await page.mouse.move(800,300);await page.mouse.down({button:'right'});await page.mouse.move(840,330,{steps:6});await page.mouse.up({button:'right'});await expect(debug).not.toHaveValue(beforePan);
 await page.mouse.wheel(0,-300);await page.getByRole('button',{name:'复位地图'}).click();await expect(debug).toHaveValue(initial);
 await page.getByRole('button',{name:'DT构建',exact:true}).click();await expect(page.getByTestId('case4-3d')).toHaveCount(0);
 failModel=true;await page.getByRole('button',{name:'DT辅助定位',exact:true}).click();await expect(page.getByRole('button',{name:'开始',exact:true})).toBeEnabled();await page.getByRole('button',{name:'3D视图',exact:true}).click();await expect(page.getByRole('alert')).toContainText('模型读取失败');
 failModel=false;await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByTestId('case4-3d')).toHaveAttribute('data-ready','true',{timeout:60000});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,modelRequests,shots,errors,output:output.pathname}));
}finally{await browser.close();}
