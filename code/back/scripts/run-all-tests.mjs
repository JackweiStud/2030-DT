/**
 * 串行跑完 case2/case3/case4 测试后再汇总退出码。
 * 避免前一个子包既有失败挡住后续子包，导致 npm test 实际跑不到 case4。
 */

import { spawnSync } from "node:child_process";

const cases = ["case2", "case3", "case4"];
let failed = false;

for (const name of cases) {
  const result = spawnSync("npm", ["--prefix", name, "test"], {
    stdio: "inherit",
  });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
