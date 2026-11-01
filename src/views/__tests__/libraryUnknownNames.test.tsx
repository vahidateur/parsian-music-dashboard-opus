// @vitest-environment jsdom
/**
 * I16 — a name outside the loaded page shows as unknown, not as blank.
 *
 * The library view resolves a teacher and a restricted student from the first
 * 200 loaded rows. A record past that page had no name in the map, and the
 * fallback was an empty string - which renders as a blank byline and reads like
 * "no teacher" rather than "this teacher is outside the page we read". The
 * project's unknown marker (D12) now stands in for a name we do not have.
 *
 * A resource with NO teacher at all is a different fact and keeps its own
 * wording («ثبت نشده»).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import {
  getLibraryRepository,
  resetRegistry,
  setLibraryRepository,
  setStudentRepository,
  setTeacherRepository,
} from "@/domains/registry";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { NO_DATA } from "@/lib/format";
import type { LibraryItem } from "@/domains/library/types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function item(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "lib_probe",
    title: "اتود آزمایشی",
    kind: "sheet",
    composer: "",
    instrument: "piano",
    level: "مقدماتی",
    size: "۲ صفحه",
    added: "امروز",
    uses: 0,
    teacherId: "t_missing",
    visibility: "students",
    restrictedToStudentIds: ["st_missing"],
    active: true,
    createdAt: "2026-10-30T00:00:00.000Z",
    ...over,
  } as LibraryItem;
}

/** One catalogue row whose teacher and student are outside the loaded pages. */
function stubCatalogue(rows: LibraryItem[]) {
  setLibraryRepository(
    withStubs(getLibraryRepository(), {
      list: (async () => ({
        data: rows,
        meta: { page: 1, per_page: 200, total: rows.length },
      })) as never,
    }),
  );
  // The people pages hold other people; the referenced ids are not among them.
  setStudentRepository({
    list: async () => ({
      data: [{ id: "st_known", name: "هنرجوی شناخته‌شده" }],
      meta: { page: 1, per_page: 200, total: 1 },
    }),
  } as never);
  setTeacherRepository({
    list: async () => ({
      data: [{ id: "t_known", name: "مدرس شناخته‌شده" }],
      meta: { page: 1, per_page: 200, total: 1 },
    }),
  } as never);
}

/** Opens the probe record's card (the drawer is not a dialog role). */
function openCard(container: HTMLElement) {
  const grid = container.querySelector("div.stagger.grid");
  if (!grid) throw new Error("catalogue grid not rendered");
  const card = within(grid as HTMLElement).getAllByText("اتود آزمایشی")[0]?.closest("button");
  if (!card) throw new Error("no card rendered");
  fireEvent.click(card);
}

async function renderLibrary(): Promise<HTMLElement> {
  const container = render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  ).container;
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری…")).toBeNull());
  return container;
}

describe("library names outside the loaded page (I16)", () => {
  it("shows the unknown marker instead of a blank teacher byline", async () => {
    stubCatalogue([item()]);
    await renderLibrary();
    // The title renders twice (card and the "recently added" panel), so the
    // assertions are made on the set of matches.
    await screen.findAllByText("اتود آزمایشی");
    // The card's byline is the teacher's name; it is not in the loaded page.
    expect(screen.getAllByText(NO_DATA).length).toBeGreaterThan(0);
  });

  it("shows the unknown marker for a restricted student that is not in the page", async () => {
    stubCatalogue([item()]);
    const container = await renderLibrary();
    openCard(container);
    // The drawer's restricted-student line names every student; the one
    // outside the loaded page shows the unknown marker.
    await waitFor(() => expect(document.body.textContent).toContain(NO_DATA));
  });

  it("still shows a resolved name normally", async () => {
    stubCatalogue([item({ teacherId: "t_known", restrictedToStudentIds: ["st_known"] })]);
    const container = await renderLibrary();
    await screen.findAllByText("اتود آزمایشی");
    // The known teacher's name is the byline, not the unknown marker.
    expect(screen.getAllByText("مدرس شناخته‌شده").length).toBeGreaterThan(0);
    expect(screen.queryByText(NO_DATA)).toBeNull();

    openCard(container);
    await waitFor(() => expect(document.body.textContent).toContain("هنرجوی شناخته‌شده"));
    // A resolved student is named, not marked unknown.
    expect(document.body.textContent).not.toContain(`، ${NO_DATA}`);
  });
});
