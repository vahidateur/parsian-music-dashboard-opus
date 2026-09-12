// @vitest-environment jsdom
/**
 * Programs and levels through the UI.
 *
 * Level ordering is the invariant most likely to rot, so reordering and the
 * "cannot delete a level in use" refusal are both exercised here.
 *
 * Every case settles through `waitForPanel()` below, which waits for the rows
 * the repository holds rather than for a loading marker to disappear. That
 * distinction is the whole of OPEN_ITEMS I11 and is documented on the helper.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LearningPanel } from "../LearningPanel";
import { getLearningRepository, resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { faNum } from "@/lib/format";
import type { LearningLevel } from "../types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function renderPanel() {
  return render(
    <AppProvider>
      <LearningPanel />
    </AppProvider>,
  );
}

/** What the panel settled on: the selected program and its real levels. */
interface SettledPanel {
  programId: string;
  programName: string;
  levels: LearningLevel[];
}

/** The selected program's heading, «سطوح «<name>» — <count> سطح». */
function levelsHeading(): HTMLElement {
  return screen.getByText(/سطوح «/);
}

/** The rows rendered under a given heading. */
function rowsOf(heading: HTMLElement): HTMLElement[] {
  const column = heading.closest("div")?.parentElement as HTMLElement;
  return [...column.querySelectorAll("li")] as HTMLElement[];
}

/** The levels list of the selected program. */
function levelItems(): HTMLElement[] {
  return rowsOf(levelsHeading());
}

/**
 * Wait for the state every assertion in this file is actually about: the rows
 * on screen are the rows the repository holds **for the program the heading
 * names**.
 *
 * The absence of a loading marker is not that state, and this file used to
 * wait for nothing more — which is OPEN_ITEMS I11. `useResourceList`
 * (`src/domains/shared/useResource.ts`) sets `loading` inside an effect, so
 * when the levels query's params change — which happens the moment programs
 * resolve and a program becomes selected, and again on every program switch —
 * React commits one frame that still holds the *previous* query's page with
 * `loading === false`. That frame carries no in-flight marker of any kind: no
 * `role="status"`, no `aria-busy`, neither loading string. Measured in this
 * file: a single row rendered while the store held fifteen for the named
 * program (the panel asks for `{ per_page: 0 }` before a program is selected,
 * and `paginate` clamps that to one row), and the heading
 * «سطوح «پیانو کلاسیک» — ۱۵ سطح» — piano's name over violin's fifteen rows,
 * piano having twelve. A wait on marker absence passes vacuously in that
 * frame, and a test then read `levelItems().length` as 1.
 *
 * So settle on the data, asserted against the repository that owns it. This is
 * not a sleep, not a retry budget and not a longer timeout — the default
 * `waitFor` timeout is unchanged; what changed is the condition.
 *
 * One limit, stated because it is a limit of the DOM and not of this helper:
 * rows expose a level's order and name but not its id, and two seeded programs
 * (voice and drums) have the same depth and the same level names. A stale
 * frame between those two is therefore indistinguishable on screen, and only
 * never rendering a page that does not match the params would close it
 * (I11 Tier 2, unresolved).
 */
async function waitForPanel(): Promise<SettledPanel> {
  const repository = getLearningRepository();

  return waitFor(async () => {
    // Necessary but not sufficient: a marker that IS present still means
    // "not settled", so these stay — they just no longer carry the wait.
    expect(screen.queryByText("در حال بارگذاری دوره‌ها…")).toBeNull();
    expect(screen.queryByText("در حال بارگذاری سطوح…")).toBeNull();

    const heading = levelsHeading();
    const programName = (heading.textContent ?? "").match(/سطوح «([^»]+)»/)?.[1];
    expect(programName).toBeTruthy();

    const programs = await repository.listPrograms({ per_page: 200 });
    const program = programs.data.find((candidate) => candidate.name === programName);
    expect(program).toBeDefined();

    const levels = await repository.listLevels({ programId: program!.id, per_page: 200 });
    const rows = rowsOf(heading);

    // The rows belong to the program the heading names: same count, same
    // order, same names. This is the assertion that catches a stale page from
    // another program, which no marker check can.
    expect(rows.length).toBe(levels.data.length);
    levels.data.forEach((level, index) => {
      expect(rows[index].textContent ?? "").toContain(`${faNum(level.order)}. ${level.name}`);
    });

    return { programId: program!.id, programName: programName!, levels: levels.data };
  });
}

describe("programs", () => {
  it("lists seeded programs and selects one by default", async () => {
    renderPanel();
    const settled = await waitForPanel();
    expect(screen.getByText(/سطوح «/)).toBeDefined();

    // "Selects one by default" was previously unasserted — a heading existing
    // did not say which program it belonged to. The default is the first one
    // the repository reports.
    const programs = await getLearningRepository().listPrograms({ per_page: 200 });
    expect(settled.programId).toBe(programs.data[0].id);
  });

  it("creates a program attached to an instrument", async () => {
    renderPanel();
    await waitForPanel();

    fireEvent.change(screen.getByLabelText("دورهٔ جدید"), { target: { value: "دورهٔ سنتور" } });
    fireEvent.click(screen.getAllByRole("button", { name: "افزودن" })[0]);

    await waitFor(async () => {
      const programs = await getLearningRepository().listPrograms({ per_page: 200 });
      const created = programs.data.find((p) => p.name === "دورهٔ سنتور");
      expect(created).toBeDefined();
      expect(created?.instrumentId).toBeTruthy();
    });
  });

  it("switches the level list when another program is selected", async () => {
    renderPanel();
    await waitForPanel();

    const programs = await getLearningRepository().listPrograms({ per_page: 200 });
    const other = programs.data[1];
    fireEvent.click(screen.getByText(other.name));

    await screen.findByText(new RegExp(`سطوح «${other.name}»`));
  });

  /**
   * Regression for the state that made this file flaky (OPEN_ITEMS I11).
   *
   * Switching programs changes the levels query's params, and the frame React
   * commits in between still holds the previous program's rows under the new
   * heading — observed here as «سطوح «پیانو کلاسیک» — ۱۵ سطح», piano's name
   * over violin's fifteen levels when piano has twelve. `waitForPanel()`
   * refuses that frame, so each switch below has to land on rows that belong
   * to the program named in the heading before the next one is clicked.
   */
  it("never shows one program's levels under another program's heading", async () => {
    renderPanel();
    await waitForPanel();

    const programs = await getLearningRepository().listPrograms({ per_page: 200 });
    expect(programs.data.length).toBeGreaterThan(2);

    for (const program of programs.data.slice(1)) {
      fireEvent.click(screen.getByText(program.name));

      const settled = await waitForPanel();
      expect(settled.programId).toBe(program.id);
      // So the row-count comparison above cannot pass on an empty list: every
      // seeded program has levels of its own.
      expect(settled.levels.length).toBeGreaterThan(0);
    }
  });
});

describe("levels", () => {
  it("adds a level at the end of the program", async () => {
    renderPanel();
    const { levels } = await waitForPanel();

    // Taken from the settled state rather than from a DOM that, one frame
    // earlier, could still have been showing the previous query's single row.
    // That read returned 1 for a fifteen-level program and this case then
    // failed with `expected 16 to be 2` (I11).
    const before = levels.length;
    fireEvent.change(screen.getByLabelText("سطح جدید"), { target: { value: "سطح تازه" } });
    const addButtons = screen.getAllByRole("button", { name: "افزودن" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => expect(levelItems().length).toBe(before + 1));
    expect(screen.getByText(/سطح تازه/)).toBeDefined();
  });

  it("reorders levels and keeps the ordering contiguous", async () => {
    renderPanel();
    const settled = await waitForPanel();
    // The settled program, identified by the repository instead of by matching
    // the heading against every program name.
    const programId = settled.programId;
    expect(programId).toBeDefined();
    // Moving the second level up needs a second level to move. Without this the
    // next line fails as a TypeError on `items[1]` rather than as an assertion,
    // which is how I11 first presented itself in this case.
    expect(settled.levels.length).toBeGreaterThan(1);

    const items = levelItems();
    const secondTitle = items[1].textContent ?? "";

    // Move the second level up.
    fireEvent.click(within(items[1]).getByRole("button", { name: /انتقال .* به بالا/ }));

    await waitFor(() => {
      const first = levelItems()[0].textContent ?? "";
      // Same level name, now displayed first.
      expect(first.replace(/^[۰-۹]+\. /, "")).toBe(secondTitle.replace(/^[۰-۹]+\. /, ""));
    });

    const levels = await getLearningRepository().listLevels({ programId, per_page: 200 });
    expect(levels.data.map((l) => l.order)).toEqual(levels.data.map((_, i) => i + 1));
  });

  it("disables the up arrow on the first level and the down arrow on the last", async () => {
    renderPanel();
    await waitForPanel();

    const items = levelItems();
    const firstUp = within(items[0]).getByRole("button", { name: /به بالا/ }) as HTMLButtonElement;
    const lastDown = within(items[items.length - 1]).getByRole("button", { name: /به پایین/ }) as HTMLButtonElement;
    expect(firstUp.disabled).toBe(true);
    expect(lastDown.disabled).toBe(true);
  });

  it("refuses to delete a level that still has students placed on it", async () => {
    renderPanel();
    await waitForPanel();

    const placements = await getLearningRepository().listPlacements({ per_page: 200 });
    expect(placements.data.length).toBeGreaterThan(0);
    const usedLevelId = placements.data[0].levelId;
    const level = await getLearningRepository().getLevel(usedLevelId);

    // Select the program owning that level.
    const program = await getLearningRepository().getProgram(level.programId);
    fireEvent.click(screen.getByText(program.name));
    // Waiting for the levels marker to disappear is exactly the wait I11 was
    // made of: it passes in the frame that still shows the *previous*
    // program's rows. Settle on this program's own rows, and state which
    // program they have to be.
    const settled = await waitForPanel();
    expect(settled.programId).toBe(program.id);

    const row = levelItems().find((li) => (li.textContent ?? "").includes(level.name));
    expect(row).toBeDefined();
    fireEvent.click(within(row!).getByRole("button", { name: "حذف" }));

    // Still there — the repository refused.
    await waitFor(async () => {
      const still = await getLearningRepository().listLevels({ programId: level.programId, per_page: 200 });
      expect(still.data.some((l) => l.id === usedLevelId)).toBe(true);
    });
  });

  it("deletes an empty level that was just added", async () => {
    renderPanel();
    await waitForPanel();

    fireEvent.change(screen.getByLabelText("سطح جدید"), { target: { value: "سطح موقت" } });
    const addButtons = screen.getAllByRole("button", { name: "افزودن" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    const row = await waitFor(() => {
      const found = levelItems().find((li) => (li.textContent ?? "").includes("سطح موقت"));
      expect(found).toBeDefined();
      return found!;
    });

    fireEvent.click(within(row).getByRole("button", { name: "حذف" }));
    await waitFor(() => expect(screen.queryByText(/سطح موقت/)).toBeNull());
  });
});
