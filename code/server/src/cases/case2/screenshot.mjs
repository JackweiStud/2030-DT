/** Case2 截图命名与输出目录适配；通用 PNG 逻辑位于 shared。 */

import { createPngScreenshotService } from "../../shared/png-screenshot.mjs";

export function createScreenshotService(options) {
  return createPngScreenshotService({
    ...options,
    caseId: "case2",
    filenamePrefix: "calibrated",
    outputSegments: ["out", "case2"],
  });
}
