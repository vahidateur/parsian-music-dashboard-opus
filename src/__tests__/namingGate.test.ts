/**
 * W8 — naming gate for the recorded two-composition boundary.
 *
 * This is not the W9 rename sweep. Class H stays exempt: the two canonical
 * modules may keep the word demo in their filenames. The gate locks that
 * exemption list and the current Demo*-named production files. A new Demo*
 * architecture file fails. Deleting a Class H file also fails — the exemption
 * is not a licence to delete the logic.
 *
 * The client composition may keep the recorded export-compatible names
 * `DemoNote` and `DemoServedDomain`. A new Demo* export there fails.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Canonical modules whose names are W9's to rename. Not renamed here. */
const CLASS_H = [
  "src/domains/media/demoReferences.ts",
  "src/domains/shared/demoCollection.ts",
] as const;

/**
 * Production files whose names contain "demo". Tests are not in this set.
 * Growth fails. Shrinkage fails, so a silent deletion is visible.
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
  "src/domains/media/demoReferences.ts",
  "src/domains/progress/demoRepository.ts",
  "src/domains/shared/demoCollection.ts",
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
  it("Class H is exactly the two canonical misnamed modules", () => {
    expect([...CLASS_H]).toEqual([
      "src/domains/media/demoReferences.ts",
      "src/domains/shared/demoCollection.ts",
    ]);
    for (const file of CLASS_H) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
    const references = readFileSync(join(ROOT, CLASS_H[0]), "utf8");
    const collection = readFileSync(join(ROOT, CLASS_H[1]), "utf8");
    expect(references).toMatch(/export function mediaStillReferenced\(store:\s*LocalDataStore/);
    expect(references).not.toMatch(/\bDemoStoreImpl\b/);
    expect(collection).toContain('from "./repositoryPlumbing"');
    expect(collection).toContain("paginate");
    expect(collection).not.toMatch(/function paginate/);
  });

  it("does not grow or shrink the Demo*-named production set", () => {
    const found = demoNamedProductionFiles();
    expect(namingViolations(found, DEMO_NAMED_PRODUCTION)).toEqual([]);
    expect(namingViolations([...DEMO_NAMED_PRODUCTION, "src/domains/billing/demoBilling.ts"], DEMO_NAMED_PRODUCTION)).toEqual([
      "extra src/domains/billing/demoBilling.ts",
    ]);
    expect(namingViolations(DEMO_NAMED_PRODUCTION.filter((file) => file !== CLASS_H[0]), DEMO_NAMED_PRODUCTION)).toEqual([
      `missing ${CLASS_H[0]}`,
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
