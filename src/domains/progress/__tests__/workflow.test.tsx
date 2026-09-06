// @vitest-environment jsdom
/**
 * Teacher and student progress workflows, through the real UI and repository.
 *
 * The behaviour that matters end-to-end: recording a lesson persists, appears
 * in the timeline, and CHANGES the analytics — a progress panel that showed
 * static numbers after a write would be worse than none.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentProgressPanel } from "../StudentProgressPanel";
import { getProgressRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";

afterEach(cleanup);
beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

/** A student who already has an open assignment with history. */
function studentWithHistory(): string {
  const assignment = demoStore.pieceAssignments.all().find((a) => a.latest !== undefined);
  if (!assignment) throw new Error("seed should contain an assignment with history");
  return assignment.studentId;
}

function renderPanel(studentId: string, role: "teacher" | "student" = "teacher") {
  return render(
    <AppProvider>
      <StudentProgressPanel studentId={studentId} studentName="هنرجوی آزمایشی" role={role} />
    </AppProvider>,
  );
}

async function settle() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری پیشرفت…")).toBeNull());
}

describe("teacher view", () => {
  it("shows the student's active pieces with their latest measurements", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId);
    await settle();

    const assignments = demoStore.pieceAssignments.all().filter((a) => a.studentId === studentId);
    const piece = demoStore.pieces.find(assignments[0].pieceId);
    // The title legitimately appears in both the piece card and the timeline.
    expect((await screen.findAllByText(piece!.title)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("تسلط").length).toBeGreaterThan(0);
  });

  it("records a lesson update that persists and reaches the timeline", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId);
    await settle();

    const before = demoStore.progressEvents.all().filter((e) => e.studentId === studentId).length;

    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^تسلط/), { target: { value: "77" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت پیشرفت" }));

    await waitFor(() => {
      const after = demoStore.progressEvents.all().filter((e) => e.studentId === studentId);
      expect(after.length).toBe(before + 1);
      expect(after.some((e) => e.mastery === 77)).toBe(true);
    });
  });

  it("updates the cached snapshot so the panel reflects the new mastery", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId);
    await settle();

    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^تسلط/), { target: { value: "81" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت پیشرفت" }));

    await waitFor(async () => {
      const assignments = await getProgressRepository().listAssignments({ studentId, per_page: 50 });
      expect(assignments.data.some((a) => a.latest?.mastery === 81)).toBe(true);
    });
  });

  it("rejects an out-of-range mastery before writing anything", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId);
    await settle();

    const before = demoStore.progressEvents.all().length;
    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^تسلط/), { target: { value: "150" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت پیشرفت" }));

    await screen.findByText(/عددی صحیح بین/);
    expect(demoStore.progressEvents.all().length).toBe(before);
  });

  it("rejects an implausible tempo", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId);
    await settle();

    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^تسلط/), { target: { value: "60" } });
    fireEvent.change(within(dialog).getByLabelText(/سرعت فعلی/), { target: { value: "820" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت پیشرفت" }));

    await screen.findByText(/بین ۲۰|بین 20/);
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("can assign a new piece from the repertoire", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId);
    await settle();

    const before = demoStore.pieceAssignments.all().filter((a) => a.studentId === studentId).length;

    fireEvent.click(screen.getByRole("button", { name: "افزودن قطعه" }));
    const dialog = await screen.findByRole("dialog");
    const select = within(dialog).getByLabelText(/قطعه/, { selector: "select" }) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));

    // Pick a piece not already assigned.
    const assigned = new Set(
      demoStore.pieceAssignments.all().filter((a) => a.studentId === studentId).map((a) => a.pieceId),
    );
    const free = [...select.options].find((o) => o.value && !assigned.has(o.value));
    if (!free) return;

    fireEvent.change(select, { target: { value: free.value } });
    fireEvent.click(within(dialog).getByRole("button", { name: "تخصیص قطعه" }));

    await waitFor(() => {
      const after = demoStore.pieceAssignments.all().filter((a) => a.studentId === studentId).length;
      expect(after).toBe(before + 1);
    });
  });

  it("offers a follow-up into the existing chat rather than a new messaging surface", async () => {
    renderPanel(studentWithHistory());
    await settle();
    expect(screen.getAllByRole("button", { name: /پیگیری با هنرجو/ }).length).toBeGreaterThan(0);
  });
});

describe("student view", () => {
  it("can record practice but cannot assign pieces", async () => {
    renderPanel(studentWithHistory(), "student");
    await settle();

    expect(screen.getAllByRole("button", { name: /ثبت پیشرفت/ }).length).toBeGreaterThan(0);
    // Assigning repertoire is a teacher capability.
    expect(screen.queryByRole("button", { name: "افزودن قطعه" })).toBeNull();
  });

  it("records with the student as the source", async () => {
    const studentId = studentWithHistory();
    renderPanel(studentId, "student");
    await settle();

    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^تسلط/), { target: { value: "64" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت پیشرفت" }));

    await waitFor(() => {
      const mine = demoStore.progressEvents.all().filter((e) => e.studentId === studentId && e.mastery === 64);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine[mine.length - 1].source).toBe("student");
    });
  });

  it("does not offer a teacher-note field", async () => {
    renderPanel(studentWithHistory(), "student");
    await settle();

    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "افزودن یادداشت" }));

    expect(within(dialog).queryByLabelText("یادداشت مدرس")).toBeNull();
    expect(within(dialog).getByLabelText("یادداشت هنرجو")).toBeDefined();
  });
});

describe("insights and recommendations in the UI", () => {
  it("surfaces a possible plateau with hedged wording", async () => {
    // Find the seeded student whose history is a plateau.
    const plateauStudent = demoStore.pieceAssignments
      .all()
      .find((a) => a.notes.includes("همان بخش"))?.studentId;
    expect(plateauStudent).toBeDefined();

    renderPanel(plateauStudent!);
    await settle();

    expect(await screen.findByText("احتمال توقف پیشرفت")).toBeDefined();
  });

  it("shows a reason for every recommendation", async () => {
    const plateauStudent = demoStore.pieceAssignments
      .all()
      .find((a) => a.notes.includes("همان بخش"))?.studentId;
    renderPanel(plateauStudent!);
    await settle();

    const overview = await getProgressRepository().studentOverview(plateauStudent!);
    expect(overview.recommendations.length).toBeGreaterThan(0);
    // Every reason is a real sentence, not a placeholder.
    for (const rec of overview.recommendations) {
      expect(rec.reason.length).toBeGreaterThan(15);
    }
  });

  it("says nothing rather than inventing advice for a student with no data", async () => {
    const fresh = demoStore.students
      .all()
      .find((s) => !demoStore.pieceAssignments.all().some((a) => a.studentId === s.id));
    if (!fresh) return;

    renderPanel(fresh.id);
    await settle();
    expect(screen.getByText("قطعه‌ای در دست کار نیست")).toBeDefined();
  });
});

describe("history integrity", () => {
  it("keeps earlier events untouched when a new one is recorded", async () => {
    const studentId = studentWithHistory();
    const before = demoStore.progressEvents.all().filter((e) => e.studentId === studentId);
    const snapshot = JSON.stringify([...before].sort((a, b) => a.id.localeCompare(b.id)));

    renderPanel(studentId);
    await settle();

    fireEvent.click(screen.getAllByRole("button", { name: /ثبت پیشرفت/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^تسلط/), { target: { value: "70" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ثبت پیشرفت" }));

    await waitFor(() => {
      const after = demoStore.progressEvents.all().filter((e) => e.studentId === studentId);
      expect(after.length).toBe(before.length + 1);
    });

    const kept = demoStore.progressEvents
      .all()
      .filter((e) => before.some((b) => b.id === e.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(JSON.stringify(kept)).toBe(snapshot);
  });
});
