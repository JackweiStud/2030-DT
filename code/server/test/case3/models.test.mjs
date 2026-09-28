import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createCase3Router } from "../../src/cases/case3/routes.mjs";
test("case3 independently serves its GLB without business services and rejects mutations", async () => {
  const route = createCase3Router({});
  const server = createServer(async (req,res) => {
    try { await route(req,res,new URL(req.url,"http://localhost")); }
    catch(e) { res.writeHead(e.status || 400); res.end(e.message); }
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const url=`http://127.0.0.1:${server.address().port}/api/case3/models/geometry`;
  try {
    const response=await fetch(url); assert.equal(response.status,200); assert.equal(response.headers.get("content-type"),"model/gltf-binary");
    const actual=Buffer.from(await response.arrayBuffer());
    const expected=await readFile(new URL("../../../web/assets/case1/3D/Beijing_Geometry.glb",import.meta.url));
    const hash=b=>createHash("sha256").update(b).digest("hex"); assert.equal(hash(actual),hash(expected));
    const mutation=await fetch(url,{method:"POST"}); assert.equal(mutation.headers.get("allow"),"GET"); assert.notEqual(mutation.status,200);
    assert.notEqual((await fetch(url+"?path=other")).status,200);
    // 浏览器缓存：带 ETag / Last-Modified，条件请求命中时返回 304 且无正文。
    const etag=response.headers.get("etag"); const lastModified=response.headers.get("last-modified");
    assert.ok(etag); assert.ok(lastModified); assert.equal(response.headers.get("cache-control"),"no-cache");
    const byEtag=await fetch(url,{headers:{"If-None-Match":etag}}); assert.equal(byEtag.status,304); assert.equal((await byEtag.arrayBuffer()).byteLength,0);
    const byDate=await fetch(url,{headers:{"If-Modified-Since":lastModified}}); assert.equal(byDate.status,304); await byDate.arrayBuffer();
    const stale=await fetch(url,{headers:{"If-None-Match":'W/"stale"'}}); assert.equal(stale.status,200); assert.equal(Buffer.from(await stale.arrayBuffer()).length,expected.length);
  } finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
});
