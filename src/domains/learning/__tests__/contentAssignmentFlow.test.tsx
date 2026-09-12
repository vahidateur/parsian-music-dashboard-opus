// @vitest-environment jsdom
/**
 * M3 — the assignment flow through `LearningPanel`, not the surface alone.
 *
 * `LevelContentPanel.test.tsx` proves the assignment surface honest in
 * isolation. This file proves the WIRING honest, because that is where the
 * invariant actually lives: the level id handed to the repository comes from a
 * rendered row, while the `AttachContentIntent` program id must come from the
 * program this panel selected — a different query (`usePrograms`). Two values
 * read off one row cannot contradict each other, so a guard built from them
 * proves nothing; the last two cases make them disagree on purpose.
 *
 * THE CROSSING IS REAL, NOT HYPOTHETICAL. `useResourceList` sets `loading`
 * inside an effect, so when the levels query's params change React commits a
 * frame that still holds the *previous* program's page with `loading === false`
 * (OPEN_ITEMS I11/I13). In that frame the panel names one program while listing
 * another's levels, and the level rows are exactly the stale rows that must not
 * become a write target. The adversarial case reproduces that page at the
 * repository boundary — one crossed answer, everything else real — so it can be
 * asserted instead of raced.
 *
 * TEST DISCIPLINE. Every wait is data-derived: the heading names the program the
 * rows belong to, and the rows are the ones the store holds. Nothing waits for a
 * loading flag to clear, since that flag is under test. No sleep, no retry
 * budget, no increased timeout, no skipped or weakened case.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Page } from "@/api/types";
import { AppProvider } from "@/context/AppContext";
import { Toasts } from "@/components/overlays/ActionSheet";
import { getLearningRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { faNum } from "@/lib/format";
import { DemoLearningRepository } from "../demoRepository";
import { LearningPanel } from "../LearningPanel";
import type { LearningRepository } from "../repository";
import type { LearningContent, LearningLevel, LearningProgram } from "../types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function renderPanel() {
  return render(
    <AppProvider>
      <LearningPanel />
      <Toasts />
    </AppProvider>,
  );
}

/**
 * The store's own view, read through a fresh repository so that a stub a case
 * installs cannot answer for the truth. A data-derived wait is only a wait if
 * the expectation comes from somewhere other than the thing being stubbed.
 */
function truth(): LearningRepository {
  return new DemoLearningRepository();
}

async function programsOf(): Promise<LearningProgram[]> {
  return (await truth().listPrograms({ per_page: 200 })).data;
}

async function levelsOf(programId: string): Promise<LearningLevel[]> {
  return (await truth().listLevels({ programId, per_page: 200 })).data;
}

/** The selected program's heading, «سطوح «<name>» — <count> سطح». */
function levelsHeading(): HTMLElement {
  return screen.getByText(/سطوح «/);
}

/**
 * The level rows only. The assignment surface deliberately renders outside this
 * column, so its content rows cannot be counted as levels here — the same
 * column the protected `LearningPanel.test.tsx` counts.
 */
function levelRows(): HTMLElement[] {
  const column = levelsHeading().closest("div")?.parentElement as HTMLElement;
  return [...column.querySelectorAll("li")] as HTMLElement[];
}

/**
 * Wait for the state every assertion here is about: the heading names this
 * program and the rows are the levels the store holds for it.
 */
async function waitForPanel(programId: string): Promise<LearningLevel[]> {
  const program = await truth().getProgram(programId);
  return waitFor(async () => {
    const levels = await levelsOf(programId);
    expect(levelsHeading().textContent ?? "").toContain(program.name);
    const rows = levelRows();
    expect(rows).toHaveLength(levels.length);
    for (const [index, level] of levels.entries()) {
      expect(rows[index].textContent ?? "").toContain(level.name);
    }
    return levels;
  });
}

/**
 * The per-level «منابع» toggle of the row that IS this level.
 *
 * Matched on the rendered `${order}. ${name}` title rather than on the name
 * alone: level names repeat across programs («سطح مقدماتی» exists in several),
 * so a name match cannot tell one program's level from another's — which is
 * precisely the distinction these cases are about. Orders are unique within a
 * program by the repository's contiguous-ordering invariant.
 */
function assignmentToggle(level: LearningLevel): HTMLButtonElement {
  const title = `${faNum(level.order)}. ${level.name}`;
  const row = levelRows().find((candidate) => (candidate.textContent ?? "").includes(title));
  if (!row) throw new Error(`no rendered level row for «${title}»`);
  return within(row).getByRole("button", { name: "منابع" }) as HTMLButtonElement;
}

/** Is any level's assignment surface open? */
function anyTogglePressed(): boolean {
  return screen
    .getAllByRole("button", { name: "منابع" })
    .some((button) => button.getAttribute("aria-pressed") === "true");
}

function surface(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    'section[aria-labelledby="level-content-heading"]',
  );
}

function surfaceText(): string {
  return surface()?.textContent ?? "";
}

function surfaceRows(): HTMLElement[] {
  return [...(surface()?.querySelectorAll("li") ?? [])] as HTMLElement[];
}

function picker(): HTMLSelectElement {
  const root = surface();
  if (!root) throw new Error("the assignment surface is not rendered");
  return within(root).getByRole("combobox") as HTMLSelectElement;
}

function pickerLabels(): string[] {
  return [...picker().options].map((option) => option.textContent ?? "");
}

function attachButton(): HTMLButtonElement {
  const root = surface();
  if (!root) throw new Error("the assignment surface is not rendered");
  return within(root).getByRole("button", {
    name: /اتصال|در حال ثبت/,
  }) as HTMLButtonElement;
}

function toast(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/** Wait for the surface to show this level's own links, as the store holds them. */
async function waitForSurface(levelId: string): Promise<LearningContent[]> {
  return waitFor(async () => {
    const root = surface();
    expect(root, "the assignment surface is not rendered").toBeTruthy();
    const linked = await truth().listContent({ levelId, per_page: 200 });
    expect(surfaceRows()).toHaveLength(linked.data.length);
    for (const content of linked.data) {
      expect(surfaceText()).toContain(content.title);
    }
    return linked.data;
  });
}

/** Click a program in the master column. */
async function selectProgram(program: LearningProgram): Promise<void> {
  const button = screen
    .getAllByRole("button")
    .find(
      (candidate) =>
        candidate.hasAttribute("aria-current") &&
        (candidate.textContent ?? "").includes(program.name),
    );
  if (!button) throw new Error(`no rendered program row for «${program.name}»`);
  fireEvent.click(button);
}

/**
 * Settles an ALREADY MOUNTED panel on a program that really owns levels — the
 * default selection when it has any, otherwise by switching, which is itself
 * part of the flow under test.
 */
async function settleOnProgramWithLevels(): Promise<{
  program: LearningProgram;
  levels: LearningLevel[];
}> {
  const programs = await programsOf();
  await waitForPanel(programs[0].id);
  for (const program of programs) {
    const levels = await levelsOf(program.id);
    if (levels.length > 0) {
      if (program.id !== programs[0].id) {
        await selectProgram(program);
        await waitForPanel(program.id);
      }
      return { program, levels };
    }
  }
  throw new Error("the store holds no program with levels");
}

/** An active resource this level does not already link: the honest picker offer. */
async function unlinkedContent(levelId: string): Promise<LearningContent> {
  const catalogue = (await truth().listContent({ per_page: 200, activeOnly: true })).data;
  const linked = await truth().listContent({ levelId, per_page: 200 });
  const linkedIds = new Set(linked.data.map((content) => content.id));
  const candidate = catalogue.find((content) => !linkedIds.has(content.id));
  if (!candidate) throw new Error("the store holds no unlinked active content");
  return candidate;
}

/** Records what the repository was actually asked to write. */
interface RecordedAttach {
  levelId: string;
  contentId: string;
  intent: { programId: string };
}

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

describe("M3 assignment flow — through LearningPanel", () => {
  it("assigns content to a level through the panel, and the link it created survives a remount", async () => {
    const view = renderPanel();
    const { program, levels } = await settleOnProgramWithLevels();
    const level = levels[0];

    // Opening the surface is a per-level act, and it says so.
    expect(assignmentToggle(level).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(assignmentToggle(level));
    expect(assignmentToggle(level).getAttribute("aria-pressed")).toBe("true");

    const linkedBefore = await waitForSurface(level.id);
    expect(surfaceText()).toContain(level.name);
    expect(surfaceText()).toContain(program.name);
    expect(surfaceText()).toContain(faNum(linkedBefore.length));

    const candidate = await unlinkedContent(level.id);
    await waitFor(() => expect(picker().disabled).toBe(false));
    // Offered from the repository's own catalogue, not from a fixture list.
    expect(pickerLabels().some((label) => label.includes(candidate.title))).toBe(true);

    fireEvent.change(picker(), { target: { value: candidate.id } });
    expect(attachButton().disabled).toBe(false);
    fireEvent.click(attachButton());

    // Feedback only because a mutation really happened — and only after it did.
    await waitFor(() => expect(toast()).toContain("متصل شد"));
    expect(toast()).not.toContain("انجام نشد");

    // The write went through the repository op, not through a local copy.
    await waitFor(async () => {
      const links = await truth().listLinks(level.id);
      expect(links.map((link) => link.contentId)).toContain(candidate.id);
    });
    const linkedAfter = await waitForSurface(level.id);
    expect(linkedAfter.map((content) => content.id)).toContain(candidate.id);
    expect(linkedAfter).toHaveLength(linkedBefore.length + 1);
    // The heading's count is the repository's, and the pick was consumed.
    expect(surfaceText()).toContain(faNum(linkedAfter.length));
    expect(picker().value).toBe("");

    // No second source of truth: a fresh mount reads the same link back.
    view.unmount();
    renderPanel();
    await waitForPanel(program.id);
    fireEvent.click(assignmentToggle(level));
    const remounted = await waitForSurface(level.id);
    expect(remounted.map((content) => content.id)).toContain(candidate.id);
  });

  it("closes the assignment surface when the program changes, instead of keeping the previous program's level armed", async () => {
    renderPanel();
    const { program, levels } = await settleOnProgramWithLevels();
    const level = levels[0];
    fireEvent.click(assignmentToggle(level));
    await waitForSurface(level.id);

    const other = (await programsOf()).find((candidate) => candidate.id !== program.id);
    expect(other, "the store must hold a second program").toBeTruthy();
    await selectProgram(other!);
    await waitForPanel(other!.id);

    // The level id belongs to the previous program, so it resolves to nothing
    // here: no surface, and nothing left armed. (`waitForPanel` above already
    // established that the rows are the new program's own levels.)
    expect(surface()).toBeNull();
    expect(screen.queryByText(/منابع سطح/)).toBeNull();
    expect(anyTogglePressed()).toBe(false);

    // The selection was dropped rather than held aside: coming back to this
    // program does not silently reopen the previous level's surface.
    await selectProgram(program);
    await waitForPanel(program.id);
    expect(surface()).toBeNull();
    expect(anyTogglePressed()).toBe(false);
    expect(assignmentToggle(level).getAttribute("aria-pressed")).toBe("false");
  });

  it("ADVERSARIAL: a stale level row cannot carry its own program into the intent once the selection has moved", async () => {
    const [first, second] = await programsOf();
    expect(second, "the store must hold a second program").toBeTruthy();
    const firstLevels = await levelsOf(first.id);
    expect(firstLevels.length).toBeGreaterThan(0);
    const staleLevel = firstLevels[0];

    const real = getLearningRepository();
    const pageOfFirst: Page<LearningLevel> = await real.listLevels({
      programId: first.id,
      per_page: 200,
    });
    const calls: RecordedAttach[] = [];
    let crossed = false;
    setLearningRepository(
      withStubs(real, {
        // ONE crossed page: asked for the second program's levels, the store
        // answers with the first program's. That is the frame `useResourceList`
        // really commits on a program switch (I11/I13) — reproduced here so the
        // hazard can be asserted instead of raced. Every other verb, including
        // the write under test, stays real.
        listLevels: (params: { programId?: string; per_page?: number } = {}) =>
          crossed && params.programId === second.id
            ? Promise.resolve(pageOfFirst)
            : real.listLevels(params),
        attachContent: (
          levelId: string,
          contentId: string,
          intent: { programId: string },
        ) => {
          calls.push({ levelId, contentId, intent });
          return real.attachContent(levelId, contentId, intent);
        },
      } satisfies Stubs<LearningRepository>),
    );

    renderPanel();
    await waitForPanel(first.id);
    const linksBefore = await truth().listLinks(staleLevel.id);

    crossed = true;
    await selectProgram(second);

    // The crossing is on screen: the heading names the second program while the
    // rows are still the first program's levels.
    await waitFor(() => {
      expect(levelsHeading().textContent ?? "").toContain(second.name);
      expect(
        levelRows().some((row) =>
          (row.textContent ?? "").includes(`${faNum(staleLevel.order)}. ${staleLevel.name}`),
        ),
      ).toBe(true);
    });

    fireEvent.click(assignmentToggle(staleLevel));
    const linked = await waitForSurface(staleLevel.id);
    // The surface names the SELECTED program, not the row's own.
    expect(surfaceText()).toContain(second.name);

    const candidate = await unlinkedContent(staleLevel.id);
    await waitFor(() => expect(picker().disabled).toBe(false));
    fireEvent.change(picker(), { target: { value: candidate.id } });
    fireEvent.click(attachButton());

    // The repository was handed the rendered row as target and the INDEPENDENT
    // program selection as intent — two different sources, visibly disagreeing.
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].levelId).toBe(staleLevel.id);
    expect(calls[0].intent.programId).toBe(second.id);
    expect(calls[0].intent.programId).not.toBe(staleLevel.programId);

    // Because they disagree, the write is refused rather than silently crossing
    // into the row's program: that is the only reason the guard means anything.
    await waitFor(() => expect(toast()).toContain("تعلق ندارد"));
    expect(toast()).not.toContain("متصل شد");
    const linksAfter = await truth().listLinks(staleLevel.id);
    expect(linksAfter.map((link) => link.id)).toEqual(linksBefore.map((link) => link.id));
    expect(linksAfter.some((link) => link.contentId === candidate.id)).toBe(false);
    expect(surfaceRows()).toHaveLength(linksBefore.length);
    expect(linked.map((content) => content.id)).not.toContain(candidate.id);
  });

  it("refuses to attach the same content twice through the panel, in the repository's own words", async () => {
    renderPanel();
    const { levels } = await settleOnProgramWithLevels();
    const level = levels[0];
    fireEvent.click(assignmentToggle(level));
    const linkedBefore = await waitForSurface(level.id);
    const candidate = await unlinkedContent(level.id);

    // Captured before the write: the page a stale read would still be holding.
    const pageBeforeAttach = await getLearningRepository().listContent({
      levelId: level.id,
      per_page: 200,
    });
    expect(pageBeforeAttach.data.map((content) => content.id)).not.toContain(candidate.id);

    await waitFor(() => expect(picker().disabled).toBe(false));
    fireEvent.change(picker(), { target: { value: candidate.id } });
    fireEvent.click(attachButton());
    await waitFor(() => expect(toast()).toContain("متصل شد"));
    const linkedAfter = await waitForSurface(level.id);
    expect(linkedAfter).toHaveLength(linkedBefore.length + 1);

    // First line of defence: the picker is derived from the repository's rows,
    // so content this level already links is no longer offered.
    await waitFor(() =>
      expect(pickerLabels().some((label) => label.includes(candidate.title))).toBe(false),
    );

    // Now force the case that derivation is supposed to make unreachable: hold
    // this level's read on the pre-attach page so the picker still offers
    // content that is already linked. Refusing it is the repository's job, not
    // the panel's — the panel must not duplicate it and must not celebrate it.
    const real = getLearningRepository();
    setLearningRepository(
      withStubs(real, {
        listContent: (params: { levelId?: string; per_page?: number } = {}) =>
          params.levelId === level.id
            ? Promise.resolve(pageBeforeAttach)
            : real.listContent(params),
      } satisfies Stubs<LearningRepository>),
    );
    fireEvent.click(assignmentToggle(level)); // close the stale surface
    expect(surface()).toBeNull();
    fireEvent.click(assignmentToggle(level)); // reopen against the stale page

    await waitFor(() => expect(picker().disabled).toBe(false));
    await waitFor(() =>
      expect(pickerLabels().some((label) => label.includes(candidate.title))).toBe(true),
    );
    fireEvent.change(picker(), { target: { value: candidate.id } });
    fireEvent.click(attachButton());

    await waitFor(() => expect(toast()).toContain("انجام نشد"));
    expect(toast()).toContain("از قبل");
    const links = await truth().listLinks(level.id);
    expect(links.filter((link) => link.contentId === candidate.id)).toHaveLength(1);
  });

  it("offers no assignment surface in an empty environment, and invents nothing", async () => {
    resetToEmptyEnvironment();
    resetRegistry();
    renderPanel();

    await screen.findByText("هنوز دوره‌ای تعریف نشده");
    expect(screen.getByText("دوره‌ای انتخاب نشده")).toBeTruthy();

    // Empty is neither a failure nor a read that never resolved.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("در حال بارگذاری دوره‌ها…")).toBeNull();
    expect(screen.queryByText("در حال بارگذاری سطوح…")).toBeNull();
    expect(screen.queryByText(/سطوح «/)).toBeNull();

    // Nothing to assign to, so nothing to assign with: no toggle, no surface,
    // no rows — and the store really is empty rather than merely unrendered.
    expect(screen.queryAllByRole("button", { name: "منابع" })).toHaveLength(0);
    expect(surface()).toBeNull();
    expect(await programsOf()).toHaveLength(0);
    expect(await truth().listLinks()).toHaveLength(0);
  });
});
