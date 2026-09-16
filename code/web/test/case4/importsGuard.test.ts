/**
 * 正式源码不得引用静态评审目录或设计输入目录。
 */
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("../../src/cases/case4/**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("case4 正式代码边界", () => {
  it("不 import web-static / 设计目录 / UX 输入 / echarts / three", () => {
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThan(5);
    const banned = /web-static|04-runtime-assets|02-ux|03-design|echarts|three/;
    for (const file of files) {
      expect({ file, hit: banned.test(sources[file] ?? "") }).toEqual({
        file,
        hit: false,
      });
    }
  });
});
