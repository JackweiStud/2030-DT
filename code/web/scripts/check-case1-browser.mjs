// Read-only case1 browser acceptance. Start a debug-enabled Vite instance first.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const url = process.env.CASE1_QA_URL || "http://127.0.0.1:5182";
const output = process.env.CASE1_QA_OUTPUT || "/tmp/case1-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const p = await context.newPage();
  const errors = [],
    requests = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.url().includes("/api/case1/"))
      requests.push({ url: r.url(), method: r.method() });
  });
  // Isolate other live cases: this acceptance must never issue control-file commands.
  await p.route("**/api/case[234]/**", (route) => route.abort());
  await p.goto(url);
  await p.locator(".case1-page").waitFor();
  assert.equal(
    await p.locator(".case1-page").getAttribute("data-view"),
    "home",
  );
  const states = {};
  for (const layer of ["geometry", "material"]) {
    await p.locator(`button[data-layer=${layer}]`).click();
    const textarea = p.getByLabel(`${layer} 视角配置`);
    await textarea.waitFor({ timeout: 30000 });
    await p.waitForFunction(
      (name) =>
        document.querySelector(`[aria-label="${name} 视角配置"]`).value.length >
        0,
      layer,
    );
    const initial = await textarea.inputValue();
    const canvas = p.locator(`#panel-${layer} canvas`);
    const box = await canvas.boundingBox();
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x + 90, y + 40, { steps: 10 });
    await p.mouse.up();
    const rotated = await textarea.inputValue();
    assert.notEqual(rotated, initial, "rotation changes camera");
    await p.mouse.wheel(0, -200);
    await p.waitForTimeout(100);
    const zoomed = await textarea.inputValue();
    assert.notEqual(zoomed, rotated, "zoom changes camera");
    await p.mouse.down({ button: "right" });
    await p.mouse.move(x + 140, y + 80, { steps: 10 });
    await p.mouse.up({ button: "right" });
    const adjusted = await textarea.inputValue();
    assert.notEqual(adjusted, zoomed, "pan changes target");
    await p
      .locator(`#panel-${layer}`)
      .getByRole("button", { name: "复制配置" })
      .click();
    assert.equal(
      await p.evaluate(() => navigator.clipboard.readText()),
      adjusted,
    );
    await p.locator(`button[data-layer=${layer}]`).click();
    await p.locator(`button[data-layer=${layer}]`).click();
    assert.equal(
      await textarea.inputValue(),
      adjusted,
      "home/detail retains pose",
    );
    states[layer] = { initial, adjusted };
    await p.screenshot({ path: `${output}/${layer}-interaction.png` });
  }
  await p.locator("button[data-layer=rf]").click();
  await p.waitForFunction(() => document.querySelector("#panel-rf [role=img]"));
  assert.match(
    await p.locator("#panel-rf [role=img]").getAttribute("aria-label"),
    /1.20.*0.80.*-33.3/,
  );
  assert.equal(
    await p.locator(".c1-rf-overlay").count(),
    1,
    "RF displays the live heatmap overlay",
  );
  await p.locator("button[data-layer=rf]").press("Space");
  assert.equal(
    await p.locator(".case1-page").getAttribute("data-view"),
    "home",
  );
  await p.locator("button[data-layer=rf]").press("Enter");
  assert.equal(await p.locator(".case1-page").getAttribute("data-view"), "rf");
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForTimeout(100);
  await p.locator("button[data-layer=geometry]").click();
  assert.equal(
    await p.locator(".case1-page").getAttribute("data-view"),
    "geometry",
  );
  assert.equal(await p.evaluate(() => document.body.scrollWidth), 1440);
  await p.getByRole("button", { name: "DT校正", exact: true }).click();
  assert.equal(await p.locator(".c1-model canvas").count(), 0);
  await p.getByRole("button", { name: "DT构建", exact: true }).click();
  assert.equal(
    await p.locator(".case1-page").getAttribute("data-view"),
    "home",
  );
  for (const layer of ["geometry", "material"]) {
    await p.locator(`button[data-layer=${layer}]`).click();
    await p.waitForFunction(
      (name) =>
        document.querySelector(`[aria-label="${name} 视角配置"]`)?.value
          .length > 0,
      layer,
    );
    assert.equal(
      await p.getByLabel(`${layer} 视角配置`).inputValue(),
      states[layer].initial,
      "case switch resets pose",
    );
  }
  assert.equal(
    await p.evaluate(
      () => Object.keys(localStorage).filter((k) => /case1/i.test(k)).length,
    ),
    0,
  );
  assert(requests.every((r) => r.method === "GET"));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        pass: true,
        checks: [
          "two GLBs",
          "rotation/zoom/pan",
          "copy env",
          "home retains pose",
          "case switch resets",
          "keyboard",
          "scaled clicks",
          "KPI values",
          "no case1 persistence/writes",
        ],
        requests,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
