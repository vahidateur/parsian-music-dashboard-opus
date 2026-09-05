import { describe, expect, it } from "vitest";
import { createEmptyDataset, createSeedDataset, deriveEnrollments, deriveUsers, SEED_VERSION } from "@/domains/demo/seed";
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

  it("contains every collection with realistic Persian data", () => {
    const seed = createSeedDataset();
    for (const name of DEMO_COLLECTIONS) expect(seed[name].length).toBeGreaterThan(0);
    expect(seed.students[0].name).toBe(students[0].name);
    expect(seed.organization.direction).toBe("rtl");
    expect(seed.organization.calendar).toBe("jalali");
  });

  it("passes its own validation, including referential integrity", () => {
    expect(validateDataset(createSeedDataset())).toEqual([]);
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
    for (const user of deriveUsers()) {
      expect(Object.keys(user).sort()).toEqual(["email", "id", "name", "roleId"]);
    }
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
