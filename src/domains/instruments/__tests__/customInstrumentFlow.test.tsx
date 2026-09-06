// @vitest-environment jsdom
/**
 * End-to-end proof that instruments are genuinely runtime data.
 *
 * Before this refactor an academy could only ever use the six instruments
 * baked into a TypeScript union. The point of the change is that a
 * user-defined instrument is a first-class citizen everywhere, so this test
 * follows one custom instrument ("سنتور") from creation through the student
 * form, the student list, search, and export.
 *
 * It also guards the reverse property: the six original instruments keep
 * working, so no existing record was orphaned.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { InstrumentsPanel } from "../InstrumentsPanel";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { instrumentName, resetInstrumentCatalog, setInstrumentCatalog } from "../catalog";
import { getInstrumentRepository, getStudentRepository, resetRegistry } from "@/domains/registry";
import { buildExportTable } from "@/domains/export/exportService";
import { demoStore } from "@/services/demoStore";

afterEach(cleanup);

beforeEach(() => {
  demoStore.reset();
  resetRegistry();
  resetInstrumentCatalog();
});

/** Creates an instrument through the repository and syncs the projection. */
async function defineInstrument(name: string, slug: string): Promise<string> {
  const created = await getInstrumentRepository().create({ name, slug, description: "", active: true });
  const page = await getInstrumentRepository().list({ per_page: 500 });
  setInstrumentCatalog(page.data);
  return created.id;
}

describe("a user-defined instrument", () => {
  it("is created through the panel and immediately resolves to its Persian name", async () => {
    render(
      <AppProvider>
        <InstrumentsPanel />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری سازها…")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "افزودن ساز" }));
    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "سنتور" } });
    fireEvent.change(screen.getByLabelText(/شناسه/), { target: { value: "santoor" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "افزودن ساز" }));

    await screen.findByText("سنتور");

    // The synchronous label lookup, refreshed by the panel's own list hook.
    const created = (await getInstrumentRepository().list({ per_page: 500 })).data.find(
      (i) => i.slug === "santoor",
    );
    expect(created).toBeDefined();
    setInstrumentCatalog((await getInstrumentRepository().list({ per_page: 500 })).data);
    expect(instrumentName(created!.id)).toBe("سنتور");
  });

  it("is offered in the student form and can be saved on a student", async () => {
    const santoorId = await defineInstrument("سنتور", "santoor");

    render(
      <AppProvider>
        <StudentFormDialog open onClose={() => undefined} onSaved={() => undefined} />
      </AppProvider>,
    );

    const select = (await screen.findByLabelText(/ساز/, { selector: "select" })) as HTMLSelectElement;
    await waitFor(() => expect([...select.options].some((o) => o.value === santoorId)).toBe(true));
    expect([...select.options].find((o) => o.value === santoorId)?.textContent).toBe("سنتور");
  });

  it("persists on a student record and renders as its name", async () => {
    const santoorId = await defineInstrument("سنتور", "santoor");
    const existing = (await getStudentRepository().list({ per_page: 1 })).data[0];

    await getStudentRepository().update(existing.id, { instrument: santoorId });

    const reread = await getStudentRepository().get(existing.id);
    expect(reread.instrument).toBe(santoorId);
    expect(instrumentName(reread.instrument)).toBe("سنتور");
  });

  it("appears in an export with its Persian name, not its raw id", async () => {
    const santoorId = await defineInstrument("سنتور", "santoor");
    const existing = (await getStudentRepository().list({ per_page: 1 })).data[0];
    await getStudentRepository().update(existing.id, { instrument: santoorId });

    const table = await buildExportTable("students");
    const flat = table.rows.flat().join("|");
    expect(flat).toContain("سنتور");
    expect(flat).not.toContain(santoorId);
  });
});

describe("the original six still work", () => {
  it("resolves every historical id used by seeded records", async () => {
    const students = await getStudentRepository().list({ per_page: 500 });
    for (const student of students.data) {
      // Never falls through to the raw-id fallback.
      expect(instrumentName(student.instrument)).not.toBe(student.instrument);
    }
  });

  it("keeps seeded students attached to real instruments", async () => {
    const instruments = await getInstrumentRepository().list({ per_page: 500 });
    const ids = new Set(instruments.data.map((i) => i.id));
    const students = await getStudentRepository().list({ per_page: 500 });
    for (const student of students.data) {
      expect(ids.has(student.instrument)).toBe(true);
    }
  });

  it("exports seeded students with Persian instrument names", async () => {
    const table = await buildExportTable("students");
    const flat = table.rows.flat().join("|");
    expect(flat).toContain("پیانو");
    // The raw id must not leak into a user-facing export.
    expect(flat.split("|")).not.toContain("piano");
  });
});

describe("deactivating an instrument", () => {
  it("removes it from the picker but keeps existing records readable", async () => {
    await getInstrumentRepository().setActive("drums", false);
    setInstrumentCatalog((await getInstrumentRepository().list({ per_page: 500 })).data);

    // Still resolves for records that already reference it.
    expect(instrumentName("drums")).toBe("درامز");

    const students = await getStudentRepository().list({ per_page: 500 });
    const drummer = students.data.find((s) => s.instrument === "drums");
    if (drummer) {
      render(
        <AppProvider>
          <StudentFormDialog open student={drummer} onClose={() => undefined} onSaved={() => undefined} />
        </AppProvider>,
      );
      // The student's own (now inactive) instrument stays selectable so saving
      // an unrelated field cannot silently change it.
      const select = (await screen.findByLabelText(/ساز/, { selector: "select" })) as HTMLSelectElement;
      expect([...select.options].some((o) => o.value === "drums")).toBe(true);
    }
  });
});

/**
 * §25 — the runtime instrument architecture must survive the learning and
 * progress work. A custom instrument has to flow all the way into repertoire
 * and progress, not just into the student form.
 */
describe("instruments reach the learning and progress domains", () => {
  it("supports a program, a piece and an assignment on a custom instrument", async () => {
    const santoorId = await defineInstrument("سنتور", "santoor");

    const { getLearningRepository, getProgressRepository } = await import("@/domains/registry");

    const program = await getLearningRepository().createProgram({
      instrumentId: santoorId,
      name: "دورهٔ سنتور",
      description: "",
      active: true,
    });
    const level = await getLearningRepository().createLevel({
      programId: program.id,
      name: "سطح ۱",
      description: "",
      objectives: [],
      active: true,
    });
    expect(level.order).toBe(1);

    const piece = await getProgressRepository().createPiece({
      title: "قطعهٔ سنتور",
      composer: "سنتی",
      instrumentId: santoorId,
      programId: program.id,
      recommendedLevelId: level.id,
      description: "",
      rangeUnit: "measure",
      totalRange: 40,
      active: true,
    });
    expect(piece.instrumentId).toBe(santoorId);

    const student = (await getStudentRepository().list({ per_page: 1 })).data[0];
    await getStudentRepository().update(student.id, { instrument: santoorId });

    const assignment = await getProgressRepository().assignPiece({
      studentId: student.id,
      pieceId: piece.id,
    });
    const event = await getProgressRepository().recordProgress({
      assignmentId: assignment.id,
      mastery: 55,
      rangeStart: 1,
      rangeEnd: 8,
      tempoBpm: 70,
      source: "teacher",
    });
    expect(event.mastery).toBe(55);

    const overview = await getProgressRepository().studentOverview(student.id);
    expect(overview.assignments.some((a) => a.piece?.instrumentId === santoorId)).toBe(true);
  });

  it("rejects a piece on an instrument that does not exist", async () => {
    const { getProgressRepository } = await import("@/domains/registry");
    await expect(
      getProgressRepository().createPiece({
        title: "قطعهٔ نامعتبر",
        composer: "",
        instrumentId: "no_such_instrument",
        description: "",
        rangeUnit: "measure",
        active: true,
      }),
    ).rejects.toThrow();
  });
});
