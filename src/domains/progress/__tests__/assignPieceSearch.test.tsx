// @vitest-environment jsdom
/**
 * I16 — the piece picker is a server-side search.
 *
 * The dialog asked for 200 pieces in one page; a piece past that page could not
 * be assigned at all, and the list claimed to be the whole catalogue. These
 * cases fail against that behaviour and pass only with a real search: the piece
 * a student needs is found by name, the chosen piece survives a new query, and
 * a short page says it is a slice.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssignPieceDialog } from "../AssignPieceDialog";
import { getProgressRepository, resetRegistry, setProgressRepository, setStudentRepository } from "@/domains/registry";
import { withStubs } from "@/test/repositoryStubs";
import type { Piece, PieceListParams } from "../types";
import type { StudentRepository } from "@/domains/students/repository";

afterEach(cleanup);
beforeEach(() => resetRegistry());

const SEARCH_PLACEHOLDER = "جست‌وجوی نام قطعه یا آهنگساز…";

function piece(index: number): Piece {
  return {
    id: `p_${index}`,
    title: `قطعهٔ شماره ${index}`,
    composer: "آهنگساز آزمایشی",
    instrumentId: "piano",
    description: "",
  } as unknown as Piece;
}

/** 120 pieces that answer `search` and `per_page` exactly as the API does. */
function stubPieces(count: number) {
  const rows = Array.from({ length: count }, (_, index) => piece(index + 1));
  const calls: PieceListParams[] = [];
  const assignPiece = vi.fn(async (input: { studentId: string; pieceId: string }) => ({
    id: "as_1",
    studentId: input.studentId,
    pieceId: input.pieceId,
    status: "learning",
    assignedAt: new Date().toISOString(),
  }));
  const listPieces = async (params: PieceListParams) => {
    calls.push(params);
    const query = params.search?.trim();
    const matched = query
      ? rows.filter((row) => `${row.title} ${row.composer}`.includes(query))
      : rows;
    const perPage = params.per_page ?? 20;
    const page = params.page ?? 1;
    return {
      data: matched.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: matched.length },
    };
  };
  setProgressRepository(
    withStubs(getProgressRepository(), {
      listPieces: listPieces as never,
      assignPiece: assignPiece as never,
    }),
  );
  return { calls, assignPiece, rows };
}

function stubStudent() {
  const get = vi.fn(async () => ({ id: "st_1", name: "هنرجو", instrument: "piano" }));
  setStudentRepository({ get } as unknown as StudentRepository);
  return get;
}

async function openDialog() {
  render(
    <AssignPieceDialog
      open
      studentId="st_1"
      studentName="هنرجو"
      onClose={() => undefined}
      onAssigned={() => undefined}
    />,
  );
  // The dialog has more than one select; the piece picker is the first.
  const select = (await screen.findAllByRole("combobox"))[0] as HTMLSelectElement;
  await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
  return select;
}

describe("AssignPieceDialog search (I16)", () => {
  it("finds a piece past the first page and assigns that id", async () => {
    const progress = stubPieces(120);
    stubStudent();
    const select = await openDialog();

    // The first page is a slice, and it says so.
    expect(select.options.length).toBe(51); // 50 + the placeholder
    expect(screen.getByText(/برای دیدن بقیه، جست‌وجو را محدود کنید/)).toBeDefined();
    expect(Array.from(select.options).some((option) => option.value === "p_99")).toBe(false);

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: "قطعهٔ شماره 99" },
    });
    await waitFor(() => expect(progress.calls.some((call) => call.search === "قطعهٔ شماره 99")).toBe(true));
    await waitFor(() =>
      expect(Array.from(select.options).some((option) => option.value === "p_99")).toBe(true),
    );

    fireEvent.change(select, { target: { value: "p_99" } });
    fireEvent.click(screen.getByRole("button", { name: "تخصیص قطعه" }));

    await waitFor(() => expect(progress.assignPiece).toHaveBeenCalledTimes(1));
    expect(progress.assignPiece.mock.calls[0][0]).toMatchObject({ pieceId: "p_99" });
  });

  it("keeps the chosen piece when the query changes", async () => {
    const progress = stubPieces(120);
    stubStudent();
    const select = await openDialog();
    const search = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);

    fireEvent.change(search, { target: { value: "قطعهٔ شماره 7" } });
    await waitFor(() =>
      expect(Array.from(select.options).some((option) => option.value === "p_7")).toBe(true),
    );
    fireEvent.change(select, { target: { value: "p_7" } });

    fireEvent.change(search, { target: { value: "چیزی که وجود ندارد" } });
    await waitFor(() => expect(progress.calls.some((call) => call.search === "چیزی که وجود ندارد")).toBe(true));
    expect(select.value).toBe("p_7");
    expect(Array.from(select.options).some((option) => option.value === "p_7")).toBe(true);
  });
});
