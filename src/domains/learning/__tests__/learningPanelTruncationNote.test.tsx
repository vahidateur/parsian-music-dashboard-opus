// @vitest-environment jsdom
/**
 * LearningPanel truncation note renders Persian numerals (F1 audit G-6).
 *
 * The «N ردیف از M» disclosure is written in several views; Classes, Gallery and
 * Library all format both numbers with `faNum`, while LearningPanel interpolated
 * the raw numbers, so a truncated read showed Latin digits in an otherwise
 * Persian sentence. These cases stub a truncated page — one row returned out
 * of 500 counted — and pin the note's exact wording for programs and levels.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LearningPanel } from "../LearningPanel";
import { getLearningRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs } from "@/test/repositoryStubs";
import { faNum } from "@/lib/format";

const TOTAL = 500;

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

/** A repository whose program and level reads return one real row but count TOTAL. */
async function stubTruncatedReads() {
  const real = getLearningRepository();
  const program = (await real.listPrograms({ per_page: 200 })).data[0]!;
  const level = (await real.listLevels({ per_page: 200, programId: program.id })).data[0]!;
  setLearningRepository(
    withStubs(real, {
      listPrograms: async () => ({ data: [program], meta: { page: 1, per_page: 200, total: TOTAL } }),
      listLevels: async () => ({ data: [level], meta: { page: 1, per_page: 200, total: TOTAL } }),
    }),
  );
}

describe("truncation note numerals (G-6)", () => {
  it("formats the programs note with Persian numerals", async () => {
    await stubTruncatedReads();
    renderPanel();
    const note = await screen.findByText(new RegExp(`^دوره‌ها: ${faNum(1)} ردیف از ${faNum(TOTAL)}`));
    expect(note.textContent).not.toMatch(/[0-9]/);
  });

  it("formats the levels note with Persian numerals", async () => {
    await stubTruncatedReads();
    renderPanel();
    const note = await screen.findByText(new RegExp(`^سطوح: ${faNum(1)} ردیف از ${faNum(TOTAL)}`));
    expect(note.textContent).not.toMatch(/[0-9]/);
  });

  it("shows no note when the read is complete", async () => {
    renderPanel();
    await waitFor(() => expect(screen.queryByText(/سطوح «/)).not.toBeNull());
    expect(screen.queryByText(/ردیف از/)).toBeNull();
  });
});
