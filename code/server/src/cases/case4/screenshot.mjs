/** Case4 截图命名与输出目录适配。 */

import { createPngScreenshotService } from "../../shared/png-screenshot.mjs";

export function createCase4ScreenshotService(options) {
  return createPngScreenshotService({
    ...options,
    caseId: "case4",
    filenamePrefix: "case4",
    outputSegments: ["out", "case4"],
  });
}
