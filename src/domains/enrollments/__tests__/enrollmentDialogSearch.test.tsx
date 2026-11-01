// @vitest-environment jsdom
/**
 * I16 — both enrollment pickers are server-side searches.
 *
 * The dialog asked for 200 classes and 500 students in one page and rendered
 * them as if complete, so a record past the page could not be enrolled at all.
 * These cases fail against that behaviour and pass only with a real search.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnrollmentDialog } from "../EnrollmentDialog";
import {
  resetRegistry,
  setClassRepository,
  setEnrollmentRepository,
  setStudentRepository,
} from "@/domains/registry";
import type { AcademyClass, ClassListParams } from "@/domains/classes/types";
import type { StudentRepository } from "@/domains/students/repository";
import type { EnrollmentRepository } from "../repository";

afterEach(cleanup);
beforeEach(() => resetRegistry());

function academyClass(index: number): AcademyClass {
  return {
    id: `cl_${index}`,
    title: `کلاس شماره ${index}`,
    instrument: "piano",
    teacherId: "t1",
    roomId: "r1",
    kind: "group",
    level: "مقدماتی",
    capacity: 10,
    enrolled: 1,
  } as unknown as AcademyClass;
}

function stubClasses(count: number) {
  const rows = Array.from({ length: count }, (_, index) => academyClass(index + 1));
  const calls: ClassListParams[] = [];
  const list = async (params: ClassListParams = {}) => {
    calls.push(params);
    const query = params.search?.trim();
    const matched = query ? rows.filter((row) => row.title.includes(query)) : rows;
    const perPage = params.per_page ?? 20;
    const page = params.page ?? 1;
    return {
      data: matched.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: matched.length },
    };
  };
  setClassRepository({ list } as unknown as Parameters<typeof setClassRepository>[0]);
  return { calls };
}

function stubStudents(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({ id: `st_${index + 1}`, name: `هنرجوی شماره ${index + 1}` }));
  const list = async (params: { search?: string; per_page?: number; page?: number } = {}) => {
    const query = params.search?.trim();
    const matched = query ? rows.filter((row) => row.name.includes(query)) : rows;
    const perPage = params.per_page ?? 20;
    const page = params.page ?? 1;
    return {
      data: matched.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: matched.length },
    };
  };
  setStudentRepository({ list } as unknown as StudentRepository);
}

function stubEnrollments() {
  const enroll = vi.fn(async (input: { studentId: string; classId: string }) => ({
    id: "en_1",
    studentId: input.studentId,
    classId: input.classId,
    status: "active",
  }));
  setEnrollmentRepository({
    enroll,
    list: async () => ({ data: [], meta: { page: 1, per_page: 20, total: 0 } }),
  } as unknown as EnrollmentRepository);
  return enroll;
}

async function openDialog(): Promise<[HTMLSelectElement, HTMLSelectElement]> {
  render(<EnrollmentDialog open onClose={() => undefined} onEnrolled={() => undefined} />);
  const selects = await screen.findAllByRole("combobox");
  return selects as unknown as [HTMLSelectElement, HTMLSelectElement];
}

describe("EnrollmentDialog search (I16)", () => {
  it("finds a class past the first page and enrolls into that id", async () => {
    const classes = stubClasses(120);
    stubStudents(5);
    const enroll = stubEnrollments();
    const [studentSelect, classSelect] = await openDialog();

    await waitFor(() => expect(classSelect.options.length).toBe(51)); // 50 + placeholder
    expect(Array.from(classSelect.options).some((option) => option.value === "cl_99")).toBe(false);

    fireEvent.change(screen.getByPlaceholderText("جست‌وجوی نام کلاس…"), {
      target: { value: "کلاس شماره 99" },
    });
    await waitFor(() => expect(classes.calls.some((call) => call.search === "کلاس شماره 99")).toBe(true));
    await waitFor(() =>
      expect(Array.from(classSelect.options).some((option) => option.value === "cl_99")).toBe(true),
    );

    fireEvent.change(studentSelect, { target: { value: "st_1" } });
    fireEvent.change(classSelect, { target: { value: "cl_99" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت‌نام" }));

    await waitFor(() => expect(enroll).toHaveBeenCalledTimes(1));
    expect(enroll.mock.calls[0][0]).toMatchObject({ classId: "cl_99", studentId: "st_1" });
  });

  it("says each page is a slice and keeps the chosen class across a query", async () => {
    stubClasses(120);
    stubStudents(120);
    stubEnrollments();
    const [, classSelect] = await openDialog();

    await waitFor(() =>
      expect(screen.getAllByText(/برای دیدن بقیه، جست‌وجو را محدود کنید/).length).toBe(2),
    );

    const classSearch = screen.getByPlaceholderText("جست‌وجوی نام کلاس…");
    fireEvent.change(classSearch, { target: { value: "کلاس شماره 9" } });
    await waitFor(() =>
      expect(Array.from(classSelect.options).some((option) => option.value === "cl_9")).toBe(true),
    );
    fireEvent.change(classSelect, { target: { value: "cl_9" } });

    fireEvent.change(classSearch, { target: { value: "چیزی که وجود ندارد" } });
    await waitFor(() => expect(Array.from(classSelect.options).some((option) => option.value === "cl_9")).toBe(true));
    expect(classSelect.value).toBe("cl_9");
  });
});
