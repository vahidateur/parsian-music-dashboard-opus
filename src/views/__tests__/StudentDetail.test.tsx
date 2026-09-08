// @vitest-environment jsdom
/**
 * Regression: opening a student's detail page.
 *
 * The detail view resolves `detailId` against the *loaded list*, so the list
 * request must cover every student. When the list silently fell back to the
 * default page size, any student past that boundary rendered the "not found"
 * empty state instead of their profile — the record existed, but the page it
 * lived on had never been fetched.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { StudentsView } from "@/views/Students";
import { getStudentRepository, resetRegistry } from "@/domains/registry";
import { DEFAULT_PER_PAGE } from "@/domains/shared/demoCollection";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

/** Builds the check digit so generated fixtures pass the real validator. */
function makeNationalId(seq: number): string {
  const base = String(100000000 + (seq % 800000000)).padStart(9, "0");
  const sum = [...base].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const r = sum % 11;
  return base + String(r < 2 ? r : 11 - r);
}

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/** Renders the students view with a deep link to one student. */
function renderDetail(studentId: string) {
  window.location.hash = `#/students/${studentId}`;
  return render(
    <AppProvider>
      <StudentsView />
    </AppProvider>,
  );
}

describe("student detail page", () => {
  it("opens the profile of a student beyond the first page of results", async () => {
    // Grow the dataset past the default page size so the boundary is crossed.
    const repo = getStudentRepository();
    const seeded = (await repo.list({ per_page: 500 })).data;
    const template = seeded[0];
    let seq = 1;
    while ((await repo.list({ per_page: 500 })).data.length <= DEFAULT_PER_PAGE + 5) {
      // `id` is assigned by the store, so it is not part of the create input.
      const { id: _id, ...fields } = template;
      await repo.create({
        ...fields,
        name: `هنرجوی آزمایشی ${seq}`,
        nationalId: makeNationalId(seq * 7919),
      });
      seq += 1;
    }

    const all = (await repo.list({ per_page: 500 })).data;
    expect(all.length).toBeGreaterThan(DEFAULT_PER_PAGE);
    const last = all[all.length - 1];

    renderDetail(last.id);

    // The profile must render, not the "student not found" fallback.
    await waitFor(() => expect(screen.queryByText("هنرجو یافت نشد")).toBeNull());
    // The name renders in both the breadcrumb and the page title.
    await waitFor(() => expect(screen.getAllByText(last.name).length).toBeGreaterThan(0));
  });

  it("still shows a student on the first page", async () => {
    const first = (await getStudentRepository().list({ per_page: 500 })).data[0];
    renderDetail(first.id);
    await waitFor(() => expect(screen.getAllByText(first.name).length).toBeGreaterThan(0));
    expect(screen.queryByText("هنرجو یافت نشد")).toBeNull();
  });

  it("shows the not-found state for an id that genuinely does not exist", async () => {
    renderDetail("st-does-not-exist");
    await screen.findByText("هنرجو یافت نشد");
  });
});
