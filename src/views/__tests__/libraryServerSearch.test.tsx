// @vitest-environment jsdom
/**
 * I16 — the catalogue search is the server's.
 *
 * The box filtered the 200 rows already loaded, so a resource past that page was
 * unfindable and the shelf said so. These cases prove the term reaches the list
 * query and that a resource beyond the first page can be found.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { LibraryView } from "@/views/Library";
import { getLibraryRepository, resetRegistry, setLibraryRepository } from "@/domains/registry";
import { withStubs } from "@/test/repositoryStubs";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import type { LibraryItem, LibraryListParams } from "@/domains/library/types";

/*
  Measured 2026-11-04: this case renders the whole LibraryView. On its own it
  takes ~1.9 s; alongside two other heavy view files ~3.9 s; inside the full
  parallel suite ~5.8 s, which is past the 5 s default. It completes correctly
  and passes whenever it is given the time, so this is a budget, not a hang -
  the same measured convention the other heavy view suites use.
*/
vi.setConfig({ testTimeout: 60_000 });

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

function resource(index: number): LibraryItem {
  return {
    id: `lib_${index}`,
    title: `منبع شماره ${index}`,
    composer: "",
    kind: "sheet",
    instrument: "piano",
    level: "مقدماتی",
    size: "۲ صفحه",
    added: "امروز",
    uses: 0,
    visibility: "students",
    active: true,
  } as LibraryItem;
}

/** 250 rows that answer `search` and `per_page` exactly as the API does. */
function stubLibrary(count: number) {
  const rows = Array.from({ length: count }, (_, index) => resource(index + 1));
  const calls: LibraryListParams[] = [];
  const list = async (params: LibraryListParams = {}) => {
    calls.push(params);
    const query = params.search?.trim();
    const matched = query
      ? rows.filter((row) => `${row.title} ${row.composer} ${row.level}`.includes(query))
      : rows;
    const perPage = params.per_page ?? 20;
    const page = params.page ?? 1;
    return {
      data: matched.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: matched.length },
    };
  };
  setLibraryRepository(withStubs(getLibraryRepository(), { list: list as never }));
  return { calls };
}

async function renderLibrary() {
  render(
    <AppProvider>
      <LibraryView />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.queryByText("در حال باز کردن کتابخانه…")).toBeNull());
}

describe("Library server-side search (I16)", () => {
  it("sends the term to the list query and finds a resource past the first page", async () => {
    const library = stubLibrary(250);
    await renderLibrary();

    // Idle: one page, no search term, and the slice is disclosed.
    expect(library.calls.at(-1)?.search).toBeUndefined();
    expect(library.calls.at(-1)?.per_page).toBe(200);
    expect(screen.getAllByText(/کتابخانه: .* ردیف از/).length).toBeGreaterThan(0);
    // Resource 210 is not on the first page.
    expect(screen.queryByText("منبع شماره 210")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("جستجوی عنوان، آهنگساز یا مدرس…"), {
      target: { value: "منبع شماره 210" },
    });

    await waitFor(() => expect(library.calls.some((call) => call.search === "منبع شماره 210")).toBe(true));
    expect(library.calls.at(-1)?.per_page).toBe(50);
    await waitFor(() => expect(screen.getAllByText("منبع شماره 210").length).toBeGreaterThan(0));
    // The stat cards say they describe the search result set.
    expect(screen.getAllByText(/در نتایج جست‌وجو/).length).toBeGreaterThan(0);
  });
});
