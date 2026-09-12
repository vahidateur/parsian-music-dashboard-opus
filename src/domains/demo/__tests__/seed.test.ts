import { describe, expect, it } from "vitest";
import { createEmptyDataset, createSeedDataset, deriveEnrollments, deriveUsers, SEED_VERSION } from "@/domains/demo/seed";
import {
  DEMO_LIBRARY_ASSET,
  DEMO_LIBRARY_ASSET_ID,
  DEMO_LIBRARY_RESOURCE_ID,
} from "@/domains/demo/librarySeed";
import { validateDataset } from "@/domains/demo/backup";
import { DEMO_COLLECTIONS } from "@/domains/demo/types";
import { classes, students } from "@/data/records";

describe("canonical seed", () => {
  it("is deterministic — identical output on repeated creation", () => {
    expect(JSON.stringify(createSeedDataset())).toBe(JSON.stringify(createSeedDataset()));
  });

  it("is versioned", () => {
    expect(SEED_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  /**
   * Collections that are intentionally empty in the seed.
   *
   * Gallery images stay empty because a seeded image row would point at a
   * binary the demo does not ship and render as a broken thumbnail; photos fill
   * up through the real upload flow instead.
   *
   * Attendance is recorded through the repository rather than seeded: the demo
   * opens with registers waiting to be taken, which is what exercises the UI.
   *
   * `media` is NO LONGER empty: the library ships exactly one document
   * (`demo/librarySeed.ts`). Its metadata is seeded and its bytes are
   * provisioned at bootstrap, and a record whose bytes have not landed yet is a
   * documented state the UI reports honestly — not a broken reference. Asserted
   * explicitly below rather than left implicit.
   */
  const INTENTIONALLY_EMPTY = new Set([
    "galleryImages",
    "attendanceRecords",
    "attendanceCorrections",
  ]);

  it("contains every collection with realistic Persian data", () => {
    const seed = createSeedDataset();
    for (const name of DEMO_COLLECTIONS) {
      if (INTENTIONALLY_EMPTY.has(name)) {
        expect(seed[name]).toHaveLength(0);
        continue;
      }
      expect(seed[name].length, `collection "${name}" should be seeded`).toBeGreaterThan(0);
    }
    expect(seed.students[0].name).toBe(students[0].name);
    expect(seed.organization.direction).toBe("rtl");
    expect(seed.organization.calendar).toBe("jalali");
  });

  it("passes its own validation, including referential integrity", () => {
    expect(validateDataset(createSeedDataset())).toEqual([]);
  });

  /**
   * The single binary the demo ships: one text document behind one catalogue
   * row. Asserted as a whole so a second seeded file — or a row pointing at an
   * asset that does not exist — cannot slip in unnoticed.
   */
  it("seeds exactly one media asset and links it to its library row", () => {
    const seed = createSeedDataset();
    expect(seed.media).toHaveLength(1);
    expect(seed.media[0]).toEqual(DEMO_LIBRARY_ASSET);
    expect(seed.media[0].mimeType).toBe("text/plain");
    expect(seed.media[0].sizeBytes).toBeGreaterThan(0);

    const linked = seed.resources.filter((row) => row.mediaId !== undefined);
    expect(linked.map((row) => row.id)).toEqual([DEMO_LIBRARY_RESOURCE_ID]);
    expect(linked[0].mediaId).toBe(DEMO_LIBRARY_ASSET_ID);
  });

  it("derives enrollments as the authoritative Student ↔ Class edge", () => {
    const enrollments = deriveEnrollments();
    const expected = classes.reduce((n, c) => n + c.studentIds.length, 0);
    expect(enrollments).toHaveLength(expected);
    expect(new Set(enrollments.map((e) => e.id)).size).toBe(expected);
    // A student can appear in several classes over time.
    const perStudent = enrollments.filter((e) => e.studentId === "st7");
    expect(perStudent.length).toBeGreaterThan(1);
  });

  it("derives users without any credential material", () => {
    const allowed = new Set(["id", "name", "email", "role", "status", "createdAt", "updatedAt", "teacherId"]);
    for (const user of deriveUsers()) {
      for (const key of Object.keys(user)) expect(allowed.has(key)).toBe(true);
      expect(JSON.stringify(user).toLowerCase()).not.toMatch(/password|hash|secret|token/);
    }
  });

  it("derives one signable account per role in the RBAC matrix", () => {
    const roles = new Set(deriveUsers().map((u) => u.role));
    expect(roles).toEqual(new Set(["administrator", "manager", "staff", "accountant", "teacher"]));
  });

  it("does not mutate the source data modules", () => {
    const seed = createSeedDataset();
    seed.students[0].name = "تغییر";
    expect(students[0].name).not.toBe("تغییر");
  });

  it("empty dataset is valid but has no records", () => {
    const empty = createEmptyDataset();
    expect(validateDataset(empty)).toEqual([]);
    for (const name of DEMO_COLLECTIONS) expect(empty[name]).toHaveLength(0);
    expect(empty.organization.name.length).toBeGreaterThan(0);
  });
});
