/**
 * Instrument CRUD and referential safety.
 *
 * The key architectural claim under test: instruments became runtime data
 * WITHOUT breaking the existing records that store an instrument key.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoInstrumentRepository } from "../demoRepository";
import { demoStore } from "@/services/demoStore";
import { SEEDED_INSTRUMENTS, SEEDED_INSTRUMENT_IDS } from "../catalog";
import { ApiError } from "@/api/errors";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoInstrumentRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoInstrumentRepository();
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.code : "NOT_API_ERROR";
  }
}

describe("seeded instruments stay compatible with existing records", () => {
  it("seeds one record per legacy instrument, keyed by the legacy key", async () => {
    const page = await repo.list({ per_page: 100 });
    const ids = page.data.map((i) => i.id).sort();
    expect(ids).toEqual([...SEEDED_INSTRUMENT_IDS].sort());
  });

  it("keeps the Persian labels the rest of the app already renders", async () => {
    const violin = await repo.get("violin");
    expect(violin.name).toBe(SEEDED_INSTRUMENTS.find((i) => i.id === "violin")!.name);
    expect(violin.slug).toBe("violin");
  });

  it("every seeded student's instrument resolves to a real record", async () => {
    const page = await repo.list({ per_page: 100 });
    const known = new Set(page.data.map((i) => i.id));
    for (const student of demoStore.students.all()) {
      expect(known.has(student.instrument), `student ${student.id} has unknown instrument`).toBe(true);
    }
  });
});

describe("instrument CRUD", () => {
  it("creates a custom instrument that is immediately listable", async () => {
    const created = await repo.create({
      name: "سنتور",
      slug: "santur",
      description: "ساز زهی مضرابی ایرانی.",
      active: true,
    });
    expect(created.id).toBe("santur");

    const page = await repo.list({ per_page: 100 });
    expect(page.data.some((i) => i.slug === "santur")).toBe(true);
  });

  it("renames an instrument without changing its identity key", async () => {
    const updated = await repo.update("violin", { name: "ویولن (زهی)" });
    expect(updated.name).toBe("ویولن (زهی)");
    expect(updated.slug).toBe("violin");
    // Existing records keyed on "violin" still resolve.
    expect((await repo.get("violin")).id).toBe("violin");
  });

  it("refuses to change the technical slug, which records depend on", async () => {
    expect(await codeOf(repo.update("violin", { slug: "fiddle" }))).toBe("INSTRUMENT_INVALID");
  });

  it("rejects a duplicate slug or duplicate name", async () => {
    expect(
      await codeOf(repo.create({ name: "ویولن دوم", slug: "violin", description: "", active: true })),
    ).toBe("INSTRUMENT_SLUG_TAKEN");
    expect(
      await codeOf(
        repo.create({
          name: SEEDED_INSTRUMENTS.find((i) => i.id === "piano")!.name,
          slug: "piano2",
          description: "",
          active: true,
        }),
      ),
    ).toBe("INSTRUMENT_NAME_TAKEN");
  });

  it("rejects a malformed slug", async () => {
    for (const slug of ["", "1bad", "با فاصله", "UPPER", "../escape"]) {
      expect(await codeOf(repo.create({ name: "ساز آزمایشی", slug, description: "", active: true }))).toBe(
        "INSTRUMENT_INVALID",
      );
    }
  });

  it("deactivates without deleting, and hides from the active-only picker", async () => {
    const created = await repo.create({ name: "تار", slug: "tar", description: "", active: true });
    await repo.setActive(created.id, false);

    const all = await repo.list({ per_page: 100 });
    const activeOnly = await repo.list({ per_page: 100, activeOnly: true });
    expect(all.data.some((i) => i.id === "tar")).toBe(true);
    expect(activeOnly.data.some((i) => i.id === "tar")).toBe(false);
  });

  it("refuses to delete an instrument still referenced by academy records", async () => {
    expect(await codeOf(repo.delete("piano"))).toBe("INSTRUMENT_IN_USE");
  });

  it("deletes an unreferenced instrument", async () => {
    const created = await repo.create({ name: "قانون", slug: "qanun", description: "", active: true });
    await repo.delete(created.id);
    expect(await codeOf(repo.get(created.id))).toBe("INSTRUMENT_NOT_FOUND");
  });

  it("searches by name and description", async () => {
    const page = await repo.list({ per_page: 100, search: "ارکستر" });
    expect(page.data.some((i) => i.id === "violin")).toBe(true);
  });
});
