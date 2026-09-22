/**
 * The ladder is editable where the academy reads it, and the classes that teach
 * it point at RECORDS, not at copied names.
 *
 * Two halves of item 13, pinned at the repository seam:
 *
 *   • a level's description, objectives and notes survive an update — the fields
 *     the panel used to create empty and could never fill;
 *   • a class may name the course and rung it teaches, and the repository
 *     refuses a rung from another ladder, because a class claiming two
 *     curricula at once is a timetable lie waiting to happen.
 *
 * Names are deliberately NOT stored on the class: `programId`/`levelId` are
 * references, so renaming a level in Settings renames it on every class row on
 * their next render — synchronisation by construction, not by job.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoClassRepository } from "@/domains/classes/demoRepository";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoLearningRepository } from "../demoRepository";

let store: DemoStore;
let learning: DemoLearningRepository;
let classes: DemoClassRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  store = demoStore;
  learning = new DemoLearningRepository(store);
  classes = new DemoClassRepository(store);
});

describe("a level keeps what the academy writes about it", () => {
  it("persists description, objectives and notes through update", async () => {
    const program = await learning.createProgram({
      instrumentId: "piano",
      name: "دورهٔ آزمون",
      description: "",
      active: true,
    });
    const level = await learning.createLevel({
      programId: program.id,
      name: "سطح ۱",
      description: "",
      objectives: [],
      active: true,
    });

    const saved = await learning.updateLevel(level.id, {
      description: "پایهٔ تکنیک و نت‌خوانی",
      objectives: ["سلطه بر آرپژ می‌ماژور", "دو اتود حفظی"],
      notes: "تمرین روزانهٔ پانزده دقیقه‌ای توصیه می‌شود.",
    });

    expect(saved.description).toBe("پایهٔ تکنیک و نت‌خوانی");
    expect(saved.objectives).toEqual(["سلطه بر آرپژ می‌ماژور", "دو اتود حفظی"]);
    expect(saved.notes).toBe("تمرین روزانهٔ پانزده دقیقه‌ای توصیه می‌شود.");
    // And the row in the dataset is the same row the panel will render.
    expect(store.levels.find(level.id)?.notes).toBe(saved.notes);
  });

  it("clears notes when the academy clears them", async () => {
    const program = await learning.createProgram({
      instrumentId: "violin",
      name: "دورهٔ دوم",
      description: "",
      active: true,
    });
    const level = await learning.createLevel({
      programId: program.id,
      name: "سطح ۱",
      description: "",
      objectives: [],
      notes: "یادداشت نخست",
      active: true,
    });
    const cleared = await learning.updateLevel(level.id, { notes: undefined });
    expect(cleared.notes).toBeUndefined();
  });
});

describe("a class points at a rung, never at a copied name", () => {
  it("carries program and level through create", async () => {
    const program = await learning.createProgram({
      instrumentId: "piano",
      name: "پیانو کلاسیک",
      description: "",
      active: true,
    });
    const level = await learning.createLevel({
      programId: program.id,
      name: "سطح ۲",
      description: "",
      objectives: [],
      active: true,
    });

    const created = await classes.create({
      title: "کلاس سطح دو",
      instrument: "piano",
      teacherId: "t1",
      roomId: "r1",
      kind: "group",
      level: "متوسطه",
      programId: program.id,
      levelId: level.id,
      days: [0],
      time: "17:00",
      duration: 60,
      capacity: 4,
      tuition: 1000,
    });

    expect(created.programId).toBe(program.id);
    expect(created.levelId).toBe(level.id);
  });

  it("refuses a level from another program's ladder", async () => {
    const first = await learning.createProgram({
      instrumentId: "piano",
      name: "دورهٔ یک",
      description: "",
      active: true,
    });
    const second = await learning.createProgram({
      instrumentId: "piano",
      name: "دورهٔ دو",
      description: "",
      active: true,
    });
    const foreignLevel = await learning.createLevel({
      programId: second.id,
      name: "سطح ۱",
      description: "",
      objectives: [],
      active: true,
    });

    const error = await classes
      .create({
        title: "کلاس سردرگم",
        instrument: "piano",
        teacherId: "t1",
        roomId: "r1",
        kind: "group",
        level: "پایه",
        programId: first.id,
        levelId: foreignLevel.id,
        days: [0],
        time: "17:00",
        duration: 60,
        capacity: 4,
        tuition: 1000,
      })
      .catch((cause) => cause as ApiError);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("validation");
    expect(store.classes.all().some((row) => row.title === "کلاس سردرگم")).toBe(false);
  });

  it("lets a workshop sit outside the ladder entirely", async () => {
    const created = await classes.create({
      title: "کارگاه آزاد",
      instrument: "violin",
      teacherId: "t1",
      roomId: "r1",
      kind: "group",
      level: "آزاد",
      days: [6],
      time: "10:00",
      duration: 90,
      capacity: 4,
      tuition: 500,
    });
    expect(created.programId).toBeUndefined();
    expect(created.levelId).toBeUndefined();
  });
});
