// @vitest-environment jsdom
/**
 * G-7 — Library teacher attribution.
 *
 * The gap F1 recorded: the UI promised a teacher search that the data could not
 * support. `LibraryItem` had no teacher at all, so `composer` was standing in
 * for one — and the seeded catalogue proved why that is not the same thing: six
 * rows held a real composer's name and six held a teacher's, with nothing in the
 * data to tell them apart.
 *
 * These tests pin the replacement, and they are written to FAIL if the
 * relationship is faked in any of the three ways it could be:
 *
 *   1. a teacher name in `composer` still matching (the old proxy);
 *   2. a `teacherId` that matches nothing (an unvalidated field);
 *   3. search passing while the stored relationship is removed (a match that
 *      survives its own cause).
 *
 * Each negative test is a mutation test: it breaks one thing and asserts the
 * honest behaviour disappears rather than silently continuing to look right.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { LocalLibraryRepository } from "../localRepository";
import type { LibraryItem } from "../types";

let repo: LocalLibraryRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  repo = new LocalLibraryRepository();
});

const ids = (rows: LibraryItem[]) => rows.map((r) => r.id);

async function errorFields(promise: Promise<unknown>): Promise<Record<string, string[]> | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.fields : undefined;
  }
}

describe("G-7 · a library item has a real teacher", () => {
  it("stores the teacher as a reference the academy actually holds", async () => {
    const rows = (await repo.list({ per_page: 200 })).data;
    const attributed = rows.filter((r) => r.teacherId);

    expect(attributed.length).toBeGreaterThan(0);
    for (const row of attributed) {
      // The field is a REFERENCE, not a name: it must resolve to a real teacher.
      const teacher = demoStore.teachers.find(row.teacherId!);
      expect(teacher, `${row.id} names a teacher the academy does not hold`).toBeTruthy();
      expect(teacher!.name.length).toBeGreaterThan(0);
    }
  });

  it("finds a teacher's material by that teacher's own name", async () => {
    const teacher = demoStore.teachers.find("t5")!;
    const found = await repo.list({ search: teacher.name, per_page: 200 });

    expect(found.meta.total).toBeGreaterThan(0);
    for (const row of found.data) {
      // Every hit is a hit BECAUSE of the relationship, not by luck.
      const hit = row.teacherId ? demoStore.teachers.find(row.teacherId) : undefined;
      expect(hit?.name).toBe(teacher.name);
    }
  });

  it("keeps composer and teacher independent — both can be present at once", async () => {
    const created = await repo.create({
      title: "نوکتورن اپوس ۹ شمارهٔ ۲ — نسخهٔ آموزشی",
      composer: "شوپن",
      teacherId: "t1",
      kind: "sheet",
      instrument: "piano",
      level: "پیشرفته",
    });

    expect(created.composer).toBe("شوپن");
    expect(created.teacherId).toBe("t1");

    // The work is found by its composer...
    expect(ids((await repo.list({ search: "شوپن", per_page: 200 })).data)).toContain(created.id);
    // ...and the teacher who prepared it is found by their own name, separately.
    const byTeacher = await repo.list({ search: demoStore.teachers.find("t1")!.name, per_page: 200 });
    expect(ids(byTeacher.data)).toContain(created.id);
  });
});

describe("G-7 · composer is no longer a teacher proxy", () => {
  it("does not answer a teacher search from composer", async () => {
    // The regression this whole change exists to prevent: a teacher-name query
    // hitting a row purely because that name sits in `composer`.
    const teacherName = demoStore.teachers.find("t4")!.name;
    const row = (await repo.list({ search: teacherName, per_page: 200 })).data.find(
      (r) => r.teacherId === "t4",
    )!;

    expect(row).toBeTruthy();
    // Strip the relationship; the composer is empty, so the name must vanish.
    const stripped = await repo.update(row.id, { teacherId: "" });
    expect(stripped.teacherId).toBeFalsy();
    expect(stripped.composer).toBe("");

    const after = await repo.list({ search: teacherName, per_page: 200 });
    expect(ids(after.data)).not.toContain(row.id);
  });

  it("does not let a teacher's name in composer answer for a different teacher", async () => {
    // A composer that happens to read like a teacher is still a composer. A row
    // attributed to t2 must not be found by searching t8's name just because
    // somebody typed t8's name into the composer box.
    const decoy = await repo.create({
      title: "منبع با نام هم‌نام",
      composer: demoStore.teachers.find("t8")!.name,
      teacherId: "t2",
      kind: "doc",
      instrument: "guitar",
    });

    const hits = await repo.list({ search: demoStore.teachers.find("t8")!.name, per_page: 200 });
    const hit = hits.data.find((r) => r.id === decoy.id);
    // It is findable — through `composer`, which it honestly declares — but it is
    // NOT presented as t8's material.
    expect(hit).toBeTruthy();
    expect(hit!.teacherId).toBe("t2");
  });

  it("searches a teacher by the name on the teacher record, not a stale copy", async () => {
    const row = (await repo.list({ per_page: 200 })).data.find((r) => r.teacherId === "t6")!;
    const original = demoStore.teachers.find("t6")!.name;

    demoStore.teachers.update("t6", { name: "نام تازهٔ مدرس" });
    const found = await repo.list({ search: "نام تازهٔ مدرس", per_page: 200 });
    expect(ids(found.data)).toContain(row.id);

    demoStore.teachers.update("t6", { name: original });
    const after = await repo.list({ search: "نام تازهٔ مدرس", per_page: 200 });
    expect(ids(after.data)).not.toContain(row.id);
  });
});

describe("G-7 · the attribution is validated and mutable", () => {
  it("rejects a teacher the academy does not hold", async () => {
    const fields = await errorFields(
      repo.create({
        title: "منبع با مدرس ناموجود",
        teacherId: "t-does-not-exist",
        kind: "doc",
        instrument: "piano",
      }),
    );

    expect(fields?.teacherId).toBeTruthy();
    expect((await repo.list({ per_page: 200 })).data.every((r) => r.teacherId !== "t-does-not-exist")).toBe(true);
  });

  it("accepts a teacher who has since left — attribution is history, not assignment", async () => {
    // The classes repository refuses an `inactive` teacher because there a
    // teacher is ASSIGNED to teach. Here the teacher is credited for material
    // they prepared, and deactivating someone must not erase that credit.
    const teacher = demoStore.teachers.find("t5")!;
    demoStore.teachers.update("t5", { status: "inactive" });

    const created = await repo.create({
      title: "جزوهٔ تئوری — تهیه‌شده پیش از بازنشستگی",
      teacherId: "t5",
      kind: "doc",
      instrument: "theory",
    });

    expect(created.teacherId).toBe(teacher.id);
    expect(ids((await repo.list({ search: teacher.name, per_page: 200 })).data)).toContain(created.id);
  });

  it("records a row with no teacher as genuinely unattributed", async () => {
    const created = await repo.create({ title: "نت بدون انتساب", kind: "sheet", instrument: "piano" });

    expect(created.teacherId).toBeUndefined();
    const hits = await repo.list({ search: demoStore.teachers.find("t1")!.name, per_page: 200 });
    expect(ids(hits.data)).not.toContain(created.id);
  });
});

describe("G-7 · the attribution survives a backup round trip", async () => {
  it("keeps teacherId through export and restore", async () => {
    const { createBackup, validateBackup, migrateBackupIfNeeded } = await import("@/domains/demo/backup");
    const { createSeedDataset } = await import("@/domains/demo/seed");
    const before = (await repo.list({ per_page: 200 })).data.filter((r) => r.teacherId);
    expect(before.length).toBeGreaterThan(0);

    const backup = createBackup(createSeedDataset(), new Date("2026-09-27T10:00:00.000Z"));
    expect(backup.data.resources.filter((r) => r.teacherId).length).toBe(before.length);

    // The envelope is restored exactly as exported — the id is data, not a
    // derived label that would be lost to a schema change.
    const result = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.backup.data.resources.filter((r) => r.teacherId);
    expect(after.map((r) => [r.id, r.teacherId])).toEqual(before.map((r) => [r.id, r.teacherId]));

    // A backup written before the field existed still loads: absent means
    // "no teacher recorded", never a broken document.
    const legacy = JSON.parse(JSON.stringify(backup));
    for (const r of legacy.data.resources) delete r.teacherId;
    const migrated = migrateBackupIfNeeded(legacy);
    expect(migrated).toBeTruthy();
    expect(migrated!.backup.data.resources.every((r) => r.teacherId === undefined)).toBe(true);
  });
});

describe("G-7 · the learning catalogue inherits the split, not the workaround", () => {
  it("describes material by its composer or its teacher, never by an empty string", async () => {
    const { deriveLearningContent } = await import("@/domains/demo/learningSeed");

    // Learning content is derived from the library catalogue, so moving the
    // teacher out of `composer` would have silently produced " · سطح" for six
    // rows had nothing followed it through.
    for (const content of deriveLearningContent()) {
      expect(content.description, `${content.id} has an empty description`).not.toMatch(/^\s*·/);
    }

    const theory = deriveLearningContent().find((c) => c.id === "lc_res8")!;
    // `LearningContent.teacherId` existed but was never populated; it is now.
    expect(theory.teacherId).toBe("t5");
    expect(theory.description).toContain("بهرام نیک‌نژاد");
    expect(theory.author).toBe("");

    // A composer's work gains no teacher, because none was ever recorded.
    const chopin = deriveLearningContent().find((c) => c.id === "lc_res1")!;
    expect(chopin.author).toBe("شوپن");
    expect(chopin.teacherId).toBeUndefined();
  });
});
