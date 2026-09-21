// @vitest-environment jsdom
/**
 * STUDENT-PROFILE-01 regression.
 *
 * A student profile crashed into a fully blank screen because the header
 * rendered `maskNationalId(student.nationalId)`, which called `.slice(-4)` on
 * an `undefined` value:
 *
 *   TypeError: Cannot read properties of undefined (reading 'slice')
 *
 * `Student.nationalId` is typed as a required string, but a persisted payload —
 * a legacy dataset or a hand-edited localStorage — can carry a row with the
 * field missing. Backup validation already reports exactly that state as
 * `MISSING_ID` (`src/domains/demo/backup.ts`), so the live read path must agree
 * with that judgement instead of throwing. With no error boundary anywhere in
 * the tree, the uncaught render throw blanked the whole app.
 *
 * The fix renders the honest missing label (`کد ملی: —`) for such a row and
 * keeps the masked display for a valid national ID. These tests pin both.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentsView } from "@/views/Students";
import { demoStore } from "@/services/demoStore";
import { resetRegistry } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { Student } from "@/domains/students/types";

const CRASH_MARKER = "Cannot read properties of undefined";
const MISSING_LABEL = "کد ملی: —";

/** Renders the students view deep-linked to one student's profile. */
function renderProfile(studentId: string) {
  window.location.hash = `#/students/${studentId}`;
  return render(
    <AppProvider>
      <StudentsView />
    </AppProvider>,
  );
}

/**
 * Removes `nationalId` from one seeded student, exactly as a legacy or edited
 * payload would present it. The store serializes with `JSON.stringify`, which
 * drops the `undefined` value, so the persisted row has no key at all.
 */
function dropNationalId(studentId: string): void {
  const dataset = demoStore.snapshot();
  const row = dataset.students.find((s) => s.id === studentId);
  if (!row) throw new Error(`seed student ${studentId} not found`);
  (row as Partial<Student>).nationalId = undefined;
  demoStore.replace(dataset);
}

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
  resetToDemoEnvironment();
});

afterEach(cleanup);

describe("STUDENT-PROFILE-01 — a profile whose student has no nationalId must not blank the app", () => {
  it("renders a student with a valid nationalId, masked, without crashing", async () => {
    renderProfile("st2");

    await waitFor(() => expect(screen.getAllByText("امیرحسین کریمی").length).toBeGreaterThan(0));

    expect(document.body.textContent).not.toContain(CRASH_MARKER);
    // st2's seeded nationalId is 2000035711; the header shows only the masked tail.
    expect(screen.getByText(/کد ملی ···5711/)).toBeTruthy();
  });

  it("renders the profile of st2 when its nationalId is missing (the exact reproduction) without crashing", async () => {
    dropNationalId("st2");
    renderProfile("st2");

    await waitFor(() => expect(screen.getAllByText("امیرحسین کریمی").length).toBeGreaterThan(0));

    expect(document.body.textContent).not.toContain(CRASH_MARKER);
    // Honest missing label, never a fabricated value and never a not-found state.
    expect(screen.getByText(MISSING_LABEL)).toBeTruthy();
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
  });

  it("applies the same missing-nationalId handling to a different student", async () => {
    dropNationalId("st1");
    renderProfile("st1");

    await waitFor(() => expect(screen.getAllByText("سارا محمدی").length).toBeGreaterThan(0));

    expect(document.body.textContent).not.toContain(CRASH_MARKER);
    expect(screen.getByText(MISSING_LABEL)).toBeTruthy();
  });
});
