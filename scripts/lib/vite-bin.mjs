/**
 * Locates the Vite CLI entry point without a shell.
 *
 * Running `node <vite entry>` directly avoids `.cmd` shims and shell quoting, so
 * the same call works under Windows cmd.exe, PowerShell and POSIX shells. It is
 * shared by scripts/dev-full.mjs and scripts/with-env.mjs so there is exactly one
 * place that knows where the binary lives.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** Absolute path of Vite's CLI script. Throws a readable error if Vite is not installed. */
export function resolveViteBin() {
  const require = createRequire(import.meta.url);
  let pkgPath;
  try {
    pkgPath = require.resolve("vite/package.json");
  } catch {
    throw new Error('Vite is not installed in node_modules. Run "npm install" in the repository root.');
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.vite;
  if (!bin) throw new Error("Could not find Vite's CLI entry in its package.json.");
  return join(dirname(pkgPath), bin);
}