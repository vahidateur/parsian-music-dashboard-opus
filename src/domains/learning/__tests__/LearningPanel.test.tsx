// @vitest-environment jsdom
/**
 * Programs and levels through the UI.
 *
 * Level ordering is the invariant most likely to rot, so reordering and the
 * "cannot delete a level in use" refusal are both exercised here.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LearningPanel } from "../LearningPanel";
import { getLearningRepository, resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

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

async function waitForPanel() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری دوره‌ها…")).toBeNull());
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری سطوح…")).toBeNull());
}

/** The levels list of the selected program. */
function levelItems(): HTMLElement[] {
  const heading = screen.getByText(/سطوح «/);
  const column = heading.closest("div")?.parentElement as HTMLElement;
  return [...column.querySelectorAll("li")] as HTMLElement[];
}

describe("programs", () => {
  it("lists seeded programs and selects one by default", async () => {
    renderPanel();
    await waitForPanel();
    expect(screen.getByText(/سطوح «/)).toBeDefined();
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
});

describe("levels", () => {
  it("adds a level at the end of the program", async () => {
    renderPanel();
    await waitForPanel();

    const before = levelItems().length;
    fireEvent.change(screen.getByLabelText("سطح جدید"), { target: { value: "سطح تازه" } });
    const addButtons = screen.getAllByRole("button", { name: "افزودن" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => expect(levelItems().length).toBe(before + 1));
    expect(screen.getByText(/سطح تازه/)).toBeDefined();
  });

  it("reorders levels and keeps the ordering contiguous", async () => {
    renderPanel();
    await waitForPanel();

    const programs = await getLearningRepository().listPrograms({ per_page: 200 });
    const programId = programs.data.find((p) => screen.queryByText(new RegExp(`سطوح «${p.name}»`)))?.id;
    expect(programId).toBeDefined();

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
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری سطوح…")).toBeNull());

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
