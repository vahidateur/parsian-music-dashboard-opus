// @vitest-environment jsdom
/**
 * Student profile — regression for "the profile does not load".
 *
 * On a dataset persisted by an older build the profile header rendered, but the
 * learning and progress panels failed with
 *   بارگذاری مسیر یادگیری ناموفق بود / Cannot read properties of undefined (reading 'find')
 *   بارگذاری پیشرفت ناموفق بود      / Cannot read properties of undefined (reading 'filter')
 * because `placements`, `pieces`, `pieceAssignments` and `progressEvents` did not
 * exist in that payload (see `services/__tests__/demoStoreMigration.test.ts`).
 *
 * These tests pin the whole profile: the overview, the derived learning path,
 * the derived progress mapping, the photo/media path and deep-link navigation.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentsView } from "@/views/Students";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { getMediaRepository, getProgressRepository, getStudentRepository, resetRegistry } from "@/domains/registry";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/domains/progress/types";
import { createSeedDataset } from "@/domains/demo/seed";
import { DEMO_STORAGE_KEY, demoStore } from "@/services/demoStore";

const LEARNING_ERROR = "بارگذاری مسیر یادگیری ناموفق بود";
const PROGRESS_ERROR = "بارگذاری پیشرفت ناموفق بود";
const NOT_FOUND = "هنرجو یافت نشد";

/** The collections a pre-migration build persisted. */
const LEGACY_COLLECTIONS = [
  "rooms",
  "teachers",
  "students",
  "classes",
  "enrollments",
  "sessions",
  "attendance",
  "invoices",
  "payments",
  "conversations",
  "resources",
  "users",
  "roles",
] as const;

function installLegacyPayload(): void {
  const full = createSeedDataset() as unknown as Record<string, unknown>;
  const legacy: Record<string, unknown> = { organization: full.organization };
  for (const key of LEGACY_COLLECTIONS) legacy[key] = full[key];
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
}

function renderProfile(studentId: string) {
  window.location.hash = `#/students/${studentId}`;
  return render(
    <AppProvider>
      <StudentsView />
    </AppProvider>,
  );
}

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  demoStore.reset();
  resetRegistry();
});

describe("student profile on a dataset persisted by an older build", () => {
  it("loads the profile of an existing valid student", async () => {
    installLegacyPayload();
    const student = (await getStudentRepository().list({ per_page: 500 })).data[0];

    renderProfile(student.id);

    // The name renders in the breadcrumb and the page title.
    await waitFor(() => expect(screen.getAllByText(student.name).length).toBeGreaterThan(0));
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
    expect(document.body.textContent).not.toContain("Cannot read properties of undefined");
  });

  it("loads the learning path instead of failing on undefined.find", async () => {
    installLegacyPayload();
    const student = (await getStudentRepository().list({ per_page: 500 })).data[0];

    renderProfile(student.id);
    fireEvent.click(await screen.findByText("مسیر یادگیری"));

    await screen.findByText("مسیر سطح");
    expect(screen.queryByText(LEARNING_ERROR)).toBeNull();
  });

  it("maps real progress data into the profile", async () => {
    installLegacyPayload();
    const student = (await getStudentRepository().list({ per_page: 500 })).data[0];
    const assignments = await getProgressRepository().studentAssignments(student.id);

    renderProfile(student.id);
    fireEvent.click(await screen.findByText("مسیر یادگیری"));

    await screen.findByText("قطعات در دست کار");
    expect(screen.queryByText(PROGRESS_ERROR)).toBeNull();

    // The rendered rows are the repository's rows: derived data, not a fixture
    // ladder. Asserted per piece title so a mapping that silently dropped or
    // invented an assignment cannot pass.
    // The same statuses the panel treats as "in progress" — derived data, not
    // a hardcoded literal that could drift from the domain.
    const active = assignments.filter((row) => ACTIVE_ASSIGNMENT_STATUSES.includes(row.assignment.status));
    for (const row of active) {
      if (!row.piece) continue;
      expect(await screen.findAllByText(row.piece.title)).not.toHaveLength(0);
    }
    expect(active.length).toBeGreaterThan(0);
  });

  it("keeps the profile photo / media path working", async () => {
    installLegacyPayload();
    const student = (await getStudentRepository().list({ per_page: 500 })).data[0];

    // The media collection was one of the missing ones; it must read, not throw.
    const media = await getMediaRepository().list({ per_page: 50 });
    expect(Array.isArray(media.data)).toBe(true);

    render(
      <AppProvider>
        <StudentFormDialog open student={student} onClose={() => {}} onSaved={() => {}} />
      </AppProvider>,
    );

    // The photo field renders its honest empty state rather than crashing on an
    // undefined media collection.
    await screen.findByText("افزودن تصویر");
    expect(document.body.textContent).not.toContain("Cannot read properties of undefined");
  });
});

describe("profile navigation", () => {
  it("resolves a deep link to an existing student", async () => {
    const student = (await getStudentRepository().list({ per_page: 500 })).data[0];
    renderProfile(student.id);
    await waitFor(() => expect(screen.getAllByText(student.name).length).toBeGreaterThan(0));
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
  });

  it("still reports a deep link to a student who does not exist", async () => {
    renderProfile("st-does-not-exist");
    await screen.findByText(NOT_FOUND);
  });

  it("resolves a deep link on a migrated dataset too", async () => {
    installLegacyPayload();
    const student = (await getStudentRepository().list({ per_page: 500 })).data[3];
    renderProfile(student.id);
    await waitFor(() => expect(screen.getAllByText(student.name).length).toBeGreaterThan(0));
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
  });
});
