/**
 * W4 — the twenty local repositories are the only implementation of their role.
 *
 * A rename that left `export class Demo*Repository` behind, or a second file
 * that re-declared the class, would be a parallel implementation. The four
 * `demoRepository.ts` files that remain are path shims for governance
 * documents; they must re-export and must not declare a class.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

const LOCAL_CLASSES = [
  "LocalAttendanceRepository",
  "LocalAuthRepository",
  "LocalBrandingRepository",
  "LocalChatRepository",
  "LocalClassRepository",
  "LocalCompensationRepository",
  "LocalEnrollmentRepository",
  "LocalGalleryRepository",
  "LocalInstrumentRepository",
  "LocalLearningRepository",
  "LocalLibraryRepository",
  "LocalMediaRepository",
  "LocalOrganizationRepository",
  "LocalProgressRepository",
  "LocalRoleRepository",
  "LocalRoomRepository",
  "LocalSchedulingRepository",
  "LocalStudentRepository",
  "LocalTeacherRepository",
  "LocalUserRepository",
] as const;

const SHIMS = [
  "src/domains/chat/demoRepository.ts",
  "src/domains/classes/demoRepository.ts",
  "src/domains/learning/demoRepository.ts",
  "src/domains/progress/demoRepository.ts",
] as const;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("canonical local repositories", () => {
  const files = sourceFiles(SRC);

  it("declares each of the twenty local classes once, and no Demo repository class", () => {
    const declarations = new Map<string, string[]>();
    const demoClasses: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/^export class (\w+)/gm)) {
        const name = match[1];
        if (/^Demo\w+Repository$/.test(name)) demoClasses.push(`${file} ${name}`);
        if ((LOCAL_CLASSES as readonly string[]).includes(name)) {
          const rel = file.slice(SRC.length + 1);
          declarations.set(name, [...(declarations.get(name) ?? []), rel]);
        }
      }
    }
    expect(demoClasses).toEqual([]);
    expect([...declarations.keys()].sort()).toEqual([...LOCAL_CLASSES].sort());
    for (const name of LOCAL_CLASSES) {
      expect(declarations.get(name), name).toHaveLength(1);
    }
  });

  it("keeps the governance path shims as re-exports, not second implementations", () => {
    for (const rel of SHIMS) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      expect(text, rel).toMatch(/export \* from "\.\/localRepository"/);
      expect(text, rel).not.toMatch(/export class /);
      expect(text, rel).not.toMatch(/function /);
    }
  });

  it("points the demo composition at the local classes and leaves the client composition free of them", () => {
    const demo = readFileSync(join(SRC, "domains", "registry.ts"), "utf8");
    const client = readFileSync(join(SRC, "domains", "registry.client.ts"), "utf8");
    expect(demo).not.toMatch(/\bDemo\w+Repository\b/);
    expect(demo).toMatch(/\bLocalStudentRepository\b/);
    expect(demo).toMatch(/instanceof LocalAttendanceRepository/);
    const clientImports = client
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line) || /^\s*} from\b/.test(line))
      .join("\n");
    expect(clientImports).not.toMatch(/localRepository|demoRepository|localAuthRepository|localUserRepository|localRoleRepository/);
  });
});
