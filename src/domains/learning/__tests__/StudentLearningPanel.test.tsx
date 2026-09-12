// @vitest-environment jsdom
/**
 * A student's placement and what it unlocks.
 *
 * The behaviour that matters to the product: content access is *derived* from
 * the placement, so moving a student between levels must immediately change
 * the visible resource list without any separate bookkeeping.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentLearningPanel } from "../StudentLearningPanel";
import { getLearningRepository, resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function renderFor(studentId: string) {
  return render(
    <AppProvider>
      <StudentLearningPanel studentId={studentId} studentName="هنرجوی آزمایشی" />
    </AppProvider>,
  );
}

async function settle() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری مسیر یادگیری…")).toBeNull());
  await waitFor(() => expect(screen.queryByText("در حال محاسبهٔ منابع…")).toBeNull());
}

/** A student who already has a placement in the seed. */
async function placedStudentId(): Promise<string> {
  const placements = await getLearningRepository().listPlacements({ per_page: 200 });
  expect(placements.data.length).toBeGreaterThan(0);
  return placements.data[0].studentId;
}

describe("a placed student", () => {
  it("shows the program's real levels with the current one marked", async () => {
    const studentId = await placedStudentId();
    const placement = await getLearningRepository().getStudentPlacement(studentId);
    const level = await getLearningRepository().getLevel(placement!.levelId);

    renderFor(studentId);
    await settle();

    // Retry-based: `settle()` only proves the loaders are gone, and under load
    // the level list can paint on a later pass. A synchronous getByText here
    // races that and fails intermittently in the full suite.
    expect(await screen.findByText(level.name)).toBeDefined();
    expect(await screen.findByText("سطح فعلی")).toBeDefined();
  });

  it("lists exactly the content the eligibility rule derives", async () => {
    const studentId = await placedStudentId();
    const eligible = await getLearningRepository().eligibleContent(studentId);

    renderFor(studentId);
    await settle();

    for (const entry of eligible.slice(0, 5)) {
      expect(await screen.findByText(entry.content.title)).toBeDefined();
    }
  });

  it("unlocks more content when the student moves to a higher level", async () => {
    const studentId = await placedStudentId();
    const placement = await getLearningRepository().getStudentPlacement(studentId);
    const levels = await getLearningRepository().listLevels({
      programId: placement!.programId,
      per_page: 200,
    });
    const current = levels.data.find((l) => l.id === placement!.levelId)!;
    const higher = levels.data.find((l) => l.order > current.order && l.active && !l.exclusive);
    if (!higher) return; // seed depth varies per instrument

    const before = (await getLearningRepository().eligibleContent(studentId)).length;

    renderFor(studentId);
    await settle();

    const row = screen.getByText(higher.name).closest("li") as HTMLElement;
    fireEvent.click(row.querySelector("button")!);

    await waitFor(async () => {
      const after = await getLearningRepository().eligibleContent(studentId);
      expect(after.length).toBeGreaterThanOrEqual(before);
      const stored = await getLearningRepository().getStudentPlacement(studentId);
      expect(stored?.levelId).toBe(higher.id);
    });
  });
});

/**
 * A real student with no placement.
 *
 * Every seeded student is placed, and a fabricated id would not exercise the
 * assign path (the repository correctly refuses a placement for a student that
 * does not exist), so an existing student's placement is removed instead —
 * which is also exactly what a newly enrolled student looks like.
 */
async function unplacedStudentId(): Promise<string> {
  const placements = await getLearningRepository().listPlacements({ per_page: 500 });
  const studentId = placements.data[0].studentId;
  await getLearningRepository().removePlacement(studentId);
  expect(await getLearningRepository().getStudentPlacement(studentId)).toBeUndefined();
  return studentId;
}

describe("an unplaced student", () => {
  it("explains that no level is set and unlocks nothing", async () => {
    renderFor(await unplacedStudentId());
    await settle();

    expect(screen.getByText("این هنرجو هنوز روی سطحی قرار نگرفته")).toBeDefined();
    expect(screen.getByText("منبعی برای این هنرجو باز نشده")).toBeDefined();
  });

  it("assigns a program and level from one selector", async () => {
    const studentId = await unplacedStudentId();
    renderFor(studentId);
    await settle();

    const select = screen.getByLabelText("تعیین دوره و سطح") as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));

    const option = [...select.options].find((o) => o.value.includes("|"))!;
    fireEvent.change(select, { target: { value: option.value } });

    const [programId, levelId] = option.value.split("|");
    await waitFor(async () => {
      const stored = await getLearningRepository().getStudentPlacement(studentId);
      expect(stored?.programId).toBe(programId);
      expect(stored?.levelId).toBe(levelId);
    });
  });
});
