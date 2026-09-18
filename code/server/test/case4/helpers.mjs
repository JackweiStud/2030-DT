import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CASE4_BASE_FILE,
  CASE4_CDF_FILES,
  CASE4_SUMMARY_FILE,
  CASE4_THROUGHPUT_FILES,
  CASE4_TRAJECTORY_FILES,
} from "../../src/cases/case4/constants.mjs";

export function xyzLines(count, mutate = (no) => [no, 15, 0]) {
  return Array.from({ length: count }, (_, index) => {
    const [x, y, z] = mutate(index + 1);
    return `${x},${y},${z}`;
  }).join("\n") + (count ? "\n" : "");
}

export function numericLines(values) {
  if (values.length === 0) return "";
  return `${values.join("\n")}\n`;
}

export function cdfLines(points) {
  return `${points.map((point) => `${point[0]} ${point[1]}`).join("\n")}\n`;
}

export const DEFAULT_CDF = cdfLines([
  [0, 0],
  [1, 0.5],
  [2, 1],
]);

export const DEFAULT_SUMMARY = [
  "1.36 3.55",
  "3.34 8.05",
  "0.15 0.47",
  "0.897 0",
].join("\n") + "\n";

export async function writeCase4Base(sharedDir, content = xyzLines(3)) {
  await fs.writeFile(path.join(sharedDir, "case4", CASE4_BASE_FILE), content);
}

export async function writeCase4Trajectory(sharedDir, options = {}) {
  const dataDir = path.join(sharedDir, "case4");
  await fs.writeFile(
    path.join(dataDir, CASE4_TRAJECTORY_FILES.traditional),
    options.traditional ?? xyzLines(3, (no) => [no + 0.02, 15.01, 0]),
  );
  await fs.writeFile(
    path.join(dataDir, CASE4_TRAJECTORY_FILES.commercial),
    options.commercial ?? xyzLines(3, (no) => [no + 0.05, 14.98, 0]),
  );
  await fs.writeFile(
    path.join(dataDir, CASE4_TRAJECTORY_FILES.dt),
    options.dt ?? xyzLines(3, (no) => [no, 15, 0]),
  );
}

export async function writeCase4Throughput(sharedDir, options = {}) {
  const dataDir = path.join(sharedDir, "case4");
  if (options.without !== false) {
    await fs.writeFile(
      path.join(dataDir, CASE4_THROUGHPUT_FILES.without),
      options.without ?? numericLines([8.5, 9.1]),
    );
  }
  if (options.with !== false) {
    await fs.writeFile(
      path.join(dataDir, CASE4_THROUGHPUT_FILES.with),
      options.with ?? numericLines([9.2]),
    );
  }
}

export async function writeCase4Statistics(sharedDir, options = {}) {
  const dataDir = path.join(sharedDir, "case4");
  await fs.writeFile(
    path.join(dataDir, CASE4_CDF_FILES.traditional),
    options.traditionalCdf ?? DEFAULT_CDF,
  );
  await fs.writeFile(
    path.join(dataDir, CASE4_CDF_FILES.commercial),
    options.commercialCdf ?? cdfLines([[0, 0], [2, 1]]),
  );
  await fs.writeFile(
    path.join(dataDir, CASE4_CDF_FILES.dt),
    options.dtCdf ?? cdfLines([[5.71e-5, 0], [0.1, 1]]),
  );
  await fs.writeFile(
    path.join(dataDir, CASE4_SUMMARY_FILE),
    options.summary ?? DEFAULT_SUMMARY,
  );
}

export async function writeCase4All(sharedDir, options = {}) {
  await writeCase4Base(sharedDir, options.base);
  await writeCase4Trajectory(sharedDir, options);
  await writeCase4Throughput(sharedDir, options);
  await writeCase4Statistics(sharedDir, options);
  if (options.reflection !== undefined && options.reflection !== false) {
    await writeCase4Reflection(sharedDir, options.reflection);
  }
}

export async function writeCase4Reflection(sharedDir, content) {
  await fs.writeFile(
    path.join(
      sharedDir,
      "case4",
      "ue_position_with_dt_coordinates_reflection_point.txt",
    ),
    content,
  );
}
