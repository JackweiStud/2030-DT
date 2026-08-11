/** Case3 截图命名与输出目录适配。 */

import { createPngScreenshotService } from "../../shared/png-screenshot.mjs";

export function createCase3ScreenshotService(options) {
  return createPngScreenshotService({
    ...options,
    caseId: "case3",
    filenamePrefix: "case3",
    outputSegments: ["out", "case3"],
  });
}
