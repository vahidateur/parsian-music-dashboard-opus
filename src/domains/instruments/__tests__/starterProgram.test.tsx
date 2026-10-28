// @vitest-environment jsdom
/**
 * The instrument dialog's opt-in starter program — acceptance.
 *
 * Item 12, honoured at the moment of creation: an academy that just defined an
 * instrument gets a workable curriculum at once — a program for the new
 * instrument plus its first level. The starter is OPT-IN (default on) rather
 * than silent, and a failure to build it must never undo the instrument: the
 * operator is told the instrument was saved and the program was not.
 *
 * These cases pin the wiring between the dialog and `LearningRepository`
 * (the seam that lets the client composition serve it over HTTP while the
 * demo composition serves it locally): the program carries the saved
 * instrument's id, the level carries the returned program's id, and
 * unchecking the box writes nothing to learning at all.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { Toasts } from "@/components/overlays/ActionSheet";
import { getInstrumentRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import type { LearningRepository } from "@/domains/learning/repository";
import { InstrumentFormDialog } from "../InstrumentFormDialog";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

interface RecordedCalls {
  programs: unknown[];
  levels: unknown[];
}

/** A learning repository that records starter-program writes and answers them in memory. */
function recordingLearningRepository(calls: RecordedCalls, failLevels = false): LearningRepository {
  let programs = 0;
  let levels = 0;
  return {
    createProgram: async (input: unknown) => {
      programs += 1;
      (calls.programs as unknown[]).push(input);
      return { id: `pg_new_${programs}`, ...(input as Record<string, unknown>) };
    },
    createLevel: async (input: unknown) => {
      levels += 1;
      if (failLevels) throw new Error("سطح ساخته نشد");
      (calls.levels as unknown[]).push(input);
      return { id: `lv_new_${levels}`, order: 1, ...(input as Record<string, unknown>) };
    },
  } as unknown as LearningRepository;
}

function renderDialog(onSaved = vi.fn()) {
  return render(
    <AuthProvider>
      <AppProvider>
        <InstrumentFormDialog open onClose={() => undefined} onSaved={onSaved} />
        <Toasts />
      </AppProvider>
    </AuthProvider>,
  );
}

async function fillAndSubmit(name: string, slug: string) {
  fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/شناسه/, { selector: "input" }), { target: { value: slug } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "افزودن ساز" }));
}

function toastText(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

describe("the opt-in starter program", () => {
  it("creates a program for the new instrument plus its first level, checked by default", async () => {
    const calls: RecordedCalls = { programs: [], levels: [] };
    setLearningRepository(recordingLearningRepository(calls));
    const onSaved = vi.fn();
    renderDialog(onSaved);

    await fillAndSubmit("سنتور", "santoor");

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = onSaved.mock.calls[0][0] as { id: string };
    expect(saved.id).toBe("santoor");

    // The program names the instrument the dialog just persisted…
    expect(calls.programs).toHaveLength(1);
    expect(calls.programs[0]).toMatchObject({ instrumentId: "santoor" });
    // …and the level hangs off the program the server returned, not a guess.
    expect(calls.levels).toHaveLength(1);
    expect(calls.levels[0]).toMatchObject({ programId: "pg_new_1", name: "سطح ۱" });
  });

  it("writes nothing to learning when unchecked", async () => {
    const calls: RecordedCalls = { programs: [], levels: [] };
    setLearningRepository(recordingLearningRepository(calls));
    const onSaved = vi.fn();
    renderDialog(onSaved);

    fireEvent.change(await screen.findByLabelText(/نام ساز/), { target: { value: "تار" } });
    fireEvent.change(screen.getByLabelText(/شناسه/, { selector: "input" }), { target: { value: "tar" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "افزودن ساز" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.programs).toEqual([]);
    expect(calls.levels).toEqual([]);
    expect((await getInstrumentRepository().get("tar")).name).toBe("تار");
  });

  it("keeps the saved instrument and says so when the starter program fails", async () => {
    const calls: RecordedCalls = { programs: [], levels: [] };
    setLearningRepository(recordingLearningRepository(calls, true));
    const onSaved = vi.fn();
    renderDialog(onSaved);

    await fillAndSubmit("کمانچه", "kamancheh");

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // The instrument stands on its own…
    expect((await getInstrumentRepository().get("kamancheh")).name).toBe("کمانچه");
    // …and the failure is disclosed as a failure, not a silent half-save.
    await waitFor(() => expect(toastText()).toContain("ساز ثبت شد، اما دورهٔ مقدماتی ساخته نشد"));
    expect(calls.programs).toHaveLength(1);
    expect(calls.levels).toHaveLength(0);
  });
});
