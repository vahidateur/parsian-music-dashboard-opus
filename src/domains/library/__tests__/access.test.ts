/**
 * THE ACCESS RULE — one sentence, evaluated everywhere.
 *
 * `studentCanAccess` is the only place that decides whether a library item is a
 * given student's to open. It is pure on purpose: the demo repository persists
 * what the academy set, the panel shows it, and a future student portal will
 * enforce it — three readers, one rule, no drift.
 *
 * What the rule says, in order:
 *   • a teachers-only item is not a student's at all;
 *   • a students item with no list is everybody's — the empty list means "not
 *     narrowed", never "nobody";
 *   • a students item WITH a list is exactly the listed students'.
 *
 * And what the repository owes the rule: persistence. A restriction that
 * survives create and update, clears when the academy clears it, and refuses to
 * name students the academy does not hold.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoLibraryRepository } from "../demoRepository";
import { studentCanAccess, type LibraryItem } from "../types";

const item = (over: Partial<LibraryItem>): LibraryItem => ({
  id: "x",
  title: "x",
  composer: "",
  kind: "sheet",
  instrument: "piano",
  level: "",
  size: "",
  added: "",
  uses: 0,
  ...over,
});

describe("studentCanAccess", () => {
  it("gives every student what is not narrowed", () => {
    expect(studentCanAccess(item({}), "st1")).toBe(true);
    expect(studentCanAccess(item({ restrictedToStudentIds: [] }), "st9")).toBe(true);
    expect(studentCanAccess(item({ visibility: "students" }), "st42")).toBe(true);
  });

  it("narrows to the list, and the list is exhaustive", () => {
    const narrowed = item({ restrictedToStudentIds: ["st1", "st2"] });
    expect(studentCanAccess(narrowed, "st1")).toBe(true);
    expect(studentCanAccess(narrowed, "st2")).toBe(true);
    expect(studentCanAccess(narrowed, "st3")).toBe(false);
  });

  it("keeps a teachers-only item away from students entirely", () => {
    expect(studentCanAccess(item({ visibility: "teachers" }), "st1")).toBe(false);
    // Even a listed student: the visibility gate comes first.
    expect(studentCanAccess(item({ visibility: "teachers", restrictedToStudentIds: ["st1"] }), "st1")).toBe(false);
  });
});

describe("the repository persists what the academy set", () => {
  let store: DemoStore;
  let repo: DemoLibraryRepository;

  beforeEach(() => {
    resetToDemoEnvironment();
    store = demoStore;
    repo = new DemoLibraryRepository(store);
  });

  it("carries a restriction through create, and clears it through update", async () => {
    const [first, second] = store.students.all();
    const created = await repo.create({
      title: "اتود دسترسی",
      kind: "sheet",
      instrument: "piano",
      restrictedToStudentIds: [first.id],
    });
    expect(created.restrictedToStudentIds).toEqual([first.id]);
    expect(studentCanAccess(created, first.id)).toBe(true);
    expect(studentCanAccess(created, second.id)).toBe(false);

    const widened = await repo.update(created.id, { restrictedToStudentIds: [first.id, second.id] });
    expect(studentCanAccess(widened, second.id)).toBe(true);

    const cleared = await repo.update(created.id, { restrictedToStudentIds: [] });
    expect(studentCanAccess(cleared, second.id)).toBe(true);
    expect(cleared.restrictedToStudentIds).toEqual([]);
  });

  it("refuses a restriction naming a student the academy does not hold", async () => {
    const error = await repo
      .create({ title: "منبع بی‌نام", kind: "sheet", instrument: "piano", restrictedToStudentIds: ["st_ghost"] })
      .catch((cause) => cause as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("validation");
    expect(store.resources.all().some((row) => row.title === "منبع بی‌نام")).toBe(false);
  });

  it("leaves the restriction alone when the update is about something else", async () => {
    const [first] = store.students.all();
    const created = await repo.create({
      title: "اتود پایدار",
      kind: "sheet",
      instrument: "piano",
      restrictedToStudentIds: [first.id],
    });
    const renamed = await repo.update(created.id, { title: "اتود پایدار ۲" });
    expect(renamed.restrictedToStudentIds).toEqual([first.id]);
  });
});
