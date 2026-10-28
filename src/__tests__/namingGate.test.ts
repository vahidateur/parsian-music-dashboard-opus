/**
 * W9 — naming gate for the two authorized Class-H final paths.
 *
 * W8 locked an exemption for the two misnamed canonical modules. W9 renamed
 * those modules and nothing else. This gate now requires the final paths,
 * rejects the old filenames, and still closes the remaining Demo*-named
 * production set. The client composition may still export only the recorded
 * names `DemoNote` and `DemoServedDomain`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Authorized W9 final paths. Not a licence to add a third module. */
const CLASS_H_FINAL = [
  "src/domains/media/mediaReferences.ts",
  "src/domains/shared/repositoryPlumbing.ts",
] as const;

/** Old Class-H filenames. Reintroducing either fails. */
const CLASS_H_REMOVED = [
  "src/domains/media/demoReferences.ts",
  "src/domains/shared/demoCollection.ts",
] as const;

/**
 * Production files whose names contain "demo". Tests are not in this set.
 * The two renamed Class-H files are no longer in it. Growth fails. Shrinkage
 * fails, so a silent deletion is visible. Recreating an old Class-H filename
 * fails as an extra.
 */
const DEMO_NAMED_PRODUCTION = [
  "src/components/settings/DemoDataPanel.tsx",
  "src/components/shell/DemoBackedNotice.tsx",
  "src/domains/auth/demoCredentials.ts",
  "src/domains/chat/demoRepository.ts",
  "src/domains/classes/demoRepository.ts",
  "src/domains/demo/demoDataManager.ts",
  "src/domains/demo/useDemoData.ts",
  "src/domains/gallery/demoContent.ts",
  "src/domains/learning/demoRepository.ts",
  "src/domains/library/demoContent.ts",
  "src/domains/progress/demoRepository.ts",
  "src/services/demoStore.ts",
  "src/test/demoEnvironment.ts",
] as const;

const CLIENT_DEMO_EXPORTS = [
  "src/domains/registry.client.ts:DemoServedDomain",
  "src/targets/environment.client.tsx:DemoNote",
] as const;

function demoNamedProductionFiles(root = join(ROOT, "src")): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "__tests__") continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry) && /demo/i.test(entry)) {
        out.push(full.slice(ROOT.length + 1));
      }
    }
  };
  walk(root);
  return out.sort();
}

function namingViolations(found: readonly string[], allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  const foundSet = new Set(found);
  const extra = found.filter((file) => !allowedSet.has(file)).map((file) => `extra ${file}`);
  const missing = allowed.filter((file) => !foundSet.has(file)).map((file) => `missing ${file}`);
  return [...extra, ...missing];
}

function clientDemoExports(files: readonly { path: string; source: string }[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    for (const match of file.source.matchAll(/export\s+(?:class|function|interface|type|const)\s+(Demo\w+)/g)) {
      out.push(`${file.path}:${match[1]}`);
    }
  }
  return out.sort();
}

describe("naming gate", () => {
  it("Class H final paths are the renamed media check and the existing plumbing", () => {
    expect([...CLASS_H_FINAL]).toEqual([
      "src/domains/media/mediaReferences.ts",
      "src/domains/shared/repositoryPlumbing.ts",
    ]);
    expect([...CLASS_H_REMOVED]).toEqual([
      "src/domains/media/demoReferences.ts",
      "src/domains/shared/demoCollection.ts",
    ]);
    for (const file of CLASS_H_FINAL) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
    for (const file of CLASS_H_REMOVED) {
      expect(existsSync(join(ROOT, file)), file).toBe(false);
    }
    const references = readFileSync(join(ROOT, CLASS_H_FINAL[0]), "utf8");
    const plumbing = readFileSync(join(ROOT, CLASS_H_FINAL[1]), "utf8");
    expect(references).toMatch(/export function mediaStillReferenced\(store:\s*LocalDataStore/);
    expect(references).not.toMatch(/\bDemoStoreImpl\b/);
    expect(references).not.toMatch(/function paginate/);
    expect(plumbing).toMatch(/export function paginate/);
    expect(plumbing).toContain("DEFAULT_PER_PAGE");
    expect(plumbing).not.toContain('from "./repositoryPlumbing"');
  });

  it("does not grow or shrink the Demo*-named production set", () => {
    const found = demoNamedProductionFiles();
    expect(namingViolations(found, DEMO_NAMED_PRODUCTION)).toEqual([]);
    expect(namingViolations([...DEMO_NAMED_PRODUCTION, "src/domains/billing/demoBilling.ts"], DEMO_NAMED_PRODUCTION)).toEqual([
      "extra src/domains/billing/demoBilling.ts",
    ]);
    expect(namingViolations([...DEMO_NAMED_PRODUCTION, CLASS_H_REMOVED[0]], DEMO_NAMED_PRODUCTION)).toEqual([
      `extra ${CLASS_H_REMOVED[0]}`,
    ]);
    expect(namingViolations(DEMO_NAMED_PRODUCTION.filter((file) => file !== "src/services/demoStore.ts"), DEMO_NAMED_PRODUCTION)).toEqual([
      "missing src/services/demoStore.ts",
    ]);
  });

  it("the client composition keeps only the recorded Demo* export names", () => {
    const files = [
      "src/domains/registry.client.ts",
      ...readdirSync(join(ROOT, "src", "targets"))
        .filter((name) => /\.client\.tsx?$/.test(name))
        .map((name) => `src/targets/${name}`),
    ].map((path) => ({ path, source: readFileSync(join(ROOT, path), "utf8") }));
    expect(clientDemoExports(files)).toEqual([...CLIENT_DEMO_EXPORTS]);
    expect(
      clientDemoExports([{ path: "src/targets/environment.client.tsx", source: "export class DemoStore {}" }]),
    ).toEqual(["src/targets/environment.client.tsx:DemoStore"]);
  });
});
