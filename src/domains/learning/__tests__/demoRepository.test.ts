/**
 * Learning repository — programs, levels, content links and placements
 * against the real demo store.
 *
 * The eligibility *rule* is unit-tested in `eligibility.test.ts`; here we prove
 * the repository feeds that rule the right rows and keeps the ladder coherent.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DemoLearningRepository } from "../demoRepository";
import { DemoInstrumentRepository } from "@/domains/instruments/demoRepository";
import { demoStore } from "@/services/demoStore";
import { ApiError } from "@/api/errors";

let repo: DemoLearningRepository;

beforeEach(() => {
  demoStore.reset();
  repo = new DemoLearningRepository();
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.code : "NOT_API_ERROR";
  }
}

describe("programs and per-instrument level depth", () => {
  it("seeds a different number of levels per instrument", async () => {
    const violin = await repo.listLevels({ programId: "pg_violin", per_page: 100 });
    const theory = await repo.listLevels({ programId: "pg_theory", per_page: 100 });

    // The requirement's example: violin has 15 levels — but it is not global.
    expect(violin.data).toHaveLength(15);
    expect(theory.data).toHaveLength(6);
    expect(violin.data.length).not.toBe(theory.data.length);
  });

  it("numbers levels contiguously from 1", async () => {
    const page = await repo.listLevels({ programId: "pg_guitar", per_page: 100 });
    expect(page.data.map((l) => l.order)).toEqual(page.data.map((_, i) => i + 1));
  });

  it("refuses a program for an unknown instrument", async () => {
    expect(
      await codeOf(repo.createProgram({ instrumentId: "no-such", name: "برنامه", description: "", active: true })),
    ).toBe("PROGRAM_INVALID");
  });

  it("refuses to delete a program that still has students", async () => {
    expect(await codeOf(repo.deleteProgram("pg_violin"))).toBe("PROGRAM_HAS_STUDENTS");
  });
});

describe("level lifecycle", () => {
  it("appends a new level at the end of its ladder", async () => {
    const before = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data;
    const created = await repo.createLevel({
      programId: "pg_theory",
      name: "سطح پیشرفته",
      description: "",
      objectives: [],
      active: true,
    });
    expect(created.order).toBe(before.length + 1);
  });

  it("inserting at a position shifts the siblings instead of duplicating an order", async () => {
    await repo.createLevel({
      programId: "pg_theory",
      name: "سطح درج‌شده",
      description: "",
      objectives: [],
      active: true,
      order: 2,
    });
    const after = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data;
    const orders = after.map((l) => l.order);
    expect(orders).toEqual([...new Set(orders)]);
    expect(orders).toEqual(after.map((_, i) => i + 1));
    expect(after[1].name).toBe("سطح درج‌شده");
  });

  it("reorders a level and renumbers the ladder", async () => {
    const levels = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data;
    const last = levels[levels.length - 1];

    await repo.reorderLevel(last.id, 1);
    const after = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data;

    expect(after[0].id).toBe(last.id);
    expect(after.map((l) => l.order)).toEqual(after.map((_, i) => i + 1));
  });

  it("renames a level without disturbing its order", async () => {
    const level = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data[0];
    const renamed = await repo.updateLevel(level.id, { name: "مقدماتی بازنویسی‌شده" });
    expect(renamed.name).toBe("مقدماتی بازنویسی‌شده");
    expect(renamed.order).toBe(level.order);
  });

  it("refuses to delete a level that still holds content", async () => {
    // Find a seeded level that has content attached.
    const links = await repo.listLinks();
    expect(links.length).toBeGreaterThan(0);
    expect(await codeOf(repo.deleteLevel(links[0].levelId))).toBe("LEVEL_HAS_CONTENT");
  });

  it("closes the numbering gap after a delete", async () => {
    const created = await repo.createLevel({
      programId: "pg_theory",
      name: "موقت",
      description: "",
      objectives: [],
      active: true,
      order: 1,
    });
    await repo.deleteLevel(created.id);
    const after = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data;
    expect(after.map((l) => l.order)).toEqual(after.map((_, i) => i + 1));
  });
});

describe("content links", () => {
  it("attaches content to a level without copying the record", async () => {
    const content = (await repo.listContent({ per_page: 5 })).data[0];
    const level = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data[0];
    const totalBefore = (await repo.listContent({ per_page: 500 })).meta.total;

    await repo.attachContent(level.id, content.id);

    // One more link, but not one more content row.
    expect((await repo.listContent({ per_page: 500 })).meta.total).toBe(totalBefore);
    const linked = await repo.listContent({ levelId: level.id, per_page: 100 });
    expect(linked.data.some((c) => c.id === content.id)).toBe(true);
  });

  it("refuses to attach the same content to a level twice", async () => {
    const content = (await repo.listContent({ per_page: 5 })).data[0];
    const level = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data[0];
    await repo.attachContent(level.id, content.id);
    expect(await codeOf(repo.attachContent(level.id, content.id))).toBe("CONTENT_ALREADY_LINKED");
  });

  it("allows one content item to serve several levels", async () => {
    const content = (await repo.listContent({ per_page: 5 })).data[0];
    const levels = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data;
    await repo.attachContent(levels[0].id, content.id);
    await repo.attachContent(levels[1].id, content.id);

    const links = await repo.listLinks();
    expect(links.filter((l) => l.contentId === content.id).length).toBeGreaterThanOrEqual(2);
  });

  it("detaching removes the link, not the content", async () => {
    const content = (await repo.listContent({ per_page: 5 })).data[0];
    const level = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data[0];
    await repo.attachContent(level.id, content.id);
    await repo.detachContent(level.id, content.id);

    expect(await repo.getContent(content.id)).toBeDefined();
    const linked = await repo.listContent({ levelId: level.id, per_page: 100 });
    expect(linked.data.some((c) => c.id === content.id)).toBe(false);
  });

  it("deleting content detaches it everywhere rather than leaving orphan links", async () => {
    const content = (await repo.listContent({ per_page: 5 })).data[0];
    const level = (await repo.listLevels({ programId: "pg_theory", per_page: 100 })).data[0];
    await repo.attachContent(level.id, content.id);

    await repo.deleteContent(content.id);
    const links = await repo.listLinks();
    expect(links.some((l) => l.contentId === content.id)).toBe(false);
  });
});

describe("student placement and eligibility", () => {
  /** Places st1 on the violin ladder at a given level order. */
  async function placeViolin(order: number) {
    return repo.assignPlacement({ studentId: "st1", programId: "pg_violin", levelId: `lv_violin_${order}` });
  }

  it("assigns a level and records history on change", async () => {
    await placeViolin(2);
    const moved = await placeViolin(5);
    expect(moved.levelId).toBe("lv_violin_5");
    expect(moved.history.at(-1)?.levelId).toBe("lv_violin_2");
  });

  it("re-assigning the same level does not add a bogus history entry", async () => {
    const first = await placeViolin(3);
    const again = await placeViolin(3);
    expect(again.history).toHaveLength(first.history.length);
  });

  it("refuses a level that belongs to another program", async () => {
    expect(
      await codeOf(repo.assignPlacement({ studentId: "st1", programId: "pg_violin", levelId: "lv_piano_2" })),
    ).toBe("PLACEMENT_INVALID");
  });

  it("refuses an unknown student", async () => {
    expect(
      await codeOf(repo.assignPlacement({ studentId: "st-nope", programId: "pg_violin", levelId: "lv_violin_1" })),
    ).toBe("PLACEMENT_INVALID");
  });

  it("changing a student's level immediately changes eligible content", async () => {
    // Attach known content to violin levels 1 and 4.
    const content = (await repo.listContent({ per_page: 10 })).data;
    await repo.attachContent("lv_violin_1", content[0].id);
    await repo.attachContent("lv_violin_4", content[1].id);

    await placeViolin(1);
    const atOne = await repo.eligibleContent("st1");
    expect(atOne.map((e) => e.content.id)).toContain(content[0].id);
    expect(atOne.map((e) => e.content.id)).not.toContain(content[1].id);

    await placeViolin(4);
    const atFour = await repo.eligibleContent("st1");
    expect(atFour.map((e) => e.content.id)).toContain(content[1].id);
  });

  it("attaching content to a low level immediately reaches placed students", async () => {
    await placeViolin(6);
    const content = (await repo.listContent({ per_page: 10 })).data[2];

    const before = await repo.eligibleContent("st1");
    expect(before.map((e) => e.content.id)).not.toContain(content.id);

    await repo.attachContent("lv_violin_2", content.id);
    const after = await repo.eligibleContent("st1");
    expect(after.map((e) => e.content.id)).toContain(content.id);
  });

  it("reports which students a content item reaches", async () => {
    await placeViolin(5);
    const content = (await repo.listContent({ per_page: 10 })).data[3];
    await repo.attachContent("lv_violin_3", content.id);

    const ids = await repo.eligibleStudentIds(content.id);
    expect(ids).toContain("st1");
  });

  it("an unplaced student is eligible for nothing", async () => {
    await repo.removePlacement("st1");
    expect(await repo.eligibleContent("st1")).toEqual([]);
  });
});

describe("instrument ↔ learning relationship", () => {
  it("refuses to delete an instrument that a program depends on", async () => {
    const instruments = new DemoInstrumentRepository();
    expect(await codeOf(instruments.delete("violin"))).toBe("INSTRUMENT_IN_USE");
  });
});
