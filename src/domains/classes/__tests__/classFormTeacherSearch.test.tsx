// @vitest-environment jsdom
/**
 * I16 — the class form's teacher picker searches the server.
 *
 * The dialog asked for 200 teachers in one page and rendered them as the whole
 * staff, so a teacher past that page could not be assigned to a class at all.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClassFormDialog } from "../ClassFormDialog";
import { resetRegistry, setClassRepository, setTeacherRepository } from "@/domains/registry";
import type { TeacherListParams } from "@/domains/teachers/types";
import { withStubs } from "@/test/repositoryStubs";
import { getClassRepository } from "@/domains/registry";

afterEach(cleanup);
beforeEach(() => resetRegistry());

function stubTeachers(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `t_${index + 1}`,
    name: `مدرس شماره ${index + 1}`,
    title: "مدرس",
    status: "active",
  }));
  const calls: TeacherListParams[] = [];
  setTeacherRepository({
    list: async (params: TeacherListParams = {}) => {
      calls.push(params);
      const query = params.search?.trim();
      const matched = query ? rows.filter((row) => row.name.includes(query)) : rows;
      const perPage = params.per_page ?? 20;
      const page = params.page ?? 1;
      return {
        data: matched.slice((page - 1) * perPage, page * perPage),
        meta: { page, per_page: perPage, total: matched.length },
      };
    },
  } as unknown as Parameters<typeof setTeacherRepository>[0]);
  return { calls };
}

describe("ClassFormDialog teacher search (I16)", () => {
  it("finds a teacher past the first page and keeps the choice across a query", async () => {
    const teachers = stubTeachers(250);
    setClassRepository(
      withStubs(getClassRepository(), {
        list: async () => ({ data: [], meta: { page: 1, per_page: 20, total: 0 } }) as never,
      }),
    );

    render(<ClassFormDialog open onClose={() => undefined} onSaved={() => undefined} />);
    // The dialog has more than one select; the teacher one is labelled «مدرس».
    const teacherSelect = (await screen.findByLabelText(/مدرس/)) as HTMLSelectElement;
    await waitFor(() => expect(teacherSelect.options.length).toBeGreaterThan(1));

    // The first page is a slice and says so.
    expect(teacherSelect.options.length).toBe(201); // idle page is 200 + the placeholder
    expect(screen.getByText(/برای دیدن بقیه، جست‌وجو را محدود کنید/)).toBeDefined();

    const search = screen.getByPlaceholderText("جست‌وجوی نام مدرس…");
    fireEvent.change(search, { target: { value: "مدرس شماره 210" } });
    await waitFor(() => expect(teachers.calls.some((call) => call.search === "مدرس شماره 210")).toBe(true));
    await waitFor(() =>
      expect(Array.from(teacherSelect.options).some((option) => option.value === "t_210")).toBe(true),
    );

    fireEvent.change(teacherSelect, { target: { value: "t_210" } });
    fireEvent.change(search, { target: { value: "چیزی که وجود ندارد" } });
    await waitFor(() => expect(teacherSelect.value).toBe("t_210"));
    expect(Array.from(teacherSelect.options).some((option) => option.value === "t_210")).toBe(true);
  });
});
