#!/usr/bin/env node
/**
 * Generates `data/dataset/` — the dataset artifact — from the canonical seed.
 *
 * Usage:  npm run gen:dataset
 *
 * The generation logic lives in TypeScript (`src/dataset/write.ts`), so this
 * script only boots Vite and loads it. Vite (not a bespoke loader) is what
 * resolves the project's own aliases — the same aliases the app and the suite
 * use — which is also why the bundled-asset URLs resolve to their real source
 * files here and nowhere else.
 *
 * `writeDatasetArtifact()` validates what it wrote with the same validator an
 * importer runs, and throws on a single issue: a generator that reports success
 * over a broken artifact is worse than no generator.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(join(ROOT, "package.json"))) {
  console.error(`refusing to write: ${ROOT} does not look like the repository root`);
  process.exit(1);
}
process.chdir(ROOT);

const server = await createServer({
  configFile: join(ROOT, "vite.config.ts"),
  root: ROOT,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "warn",
});

try {
  const { writeDatasetArtifact } = await server.ssrLoadModule("/src/dataset/write.ts");
  const report = writeDatasetArtifact();
  console.log(`wrote ${report.files} files (${report.bytes} bytes) to ${report.dir}/`);
  console.log(`dataset sha256: ${report.datasetSha256}`);
  if (report.removed.length > 0) console.log(`removed stale files: ${report.removed.join(", ")}`);
  console.log("the artifact validates against src/dataset/validate.ts");
} finally {
  await server.close();
}
