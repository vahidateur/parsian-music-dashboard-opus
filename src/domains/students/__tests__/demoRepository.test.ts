import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { students as seedStudents } from "@/data/records";
import { demoStore } from "@/services/demoStore";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import type { CreateStudentInput } from "@/domains/students/types";

const draft: CreateStudentInput = {
  name: "هنرجوی آزمایشی",
  instrument: "piano",
  teacherId: "t1",
  level: "سطح ۱ · پایه",
  levelStep: 1,
  status: "active",
  payment: "paid",
  sessionsUsed: 0,
  sessionsTotal: 12,
  attendance: 100,
  progress: 0,
  since: "مهر ۱۴۰۴",
  age: 20,
  phone: "۰۹۱۲ ··· ۰۰۰۰",
  lastSeen: "امروز",
  balance: 0,
};

describe("DemoStudentRepository", () => {
  let repo: DemoStudentRepository;

  beforeEach(() => {
    demoStore.reset();
    repo = new DemoStudentRepository();
  });

  it("lists seeded students with page meta", async () => {
    const page = await repo.list({ per_page: 5 });
    expect(page.data).toHaveLength(5);
    expect(page.meta).toEqual({ page: 1, per_page: 5, total: seedStudents.length });
  });

  it("filters by status, instrument and search", async () => {
    const atRisk = await repo.list({ status: "at-risk", per_page: 100 });
    expect(atRisk.data.every((s) => s.status === "at-risk")).toBe(true);

    const piano = await repo.list({ instrument: "piano", per_page: 100 });
    expect(piano.data.every((s) => s.instrument === "piano")).toBe(true);

    const search = await repo.list({ search: seedStudents[0].name });
    expect(search.data[0]?.name).toBe(seedStudents[0].name);
  });

  it("paginates", async () => {
    const first = await repo.list({ page: 1, per_page: 3 });
    const second = await repo.list({ page: 2, per_page: 3 });
    expect(first.data.map((s) => s.id)).not.toEqual(second.data.map((s) => s.id));
    expect(second.meta.page).toBe(2);
  });

  it("delegates persistence to the DemoStore instead of duplicating it", async () => {
    const spy = vi.spyOn(demoStore.students, "all");
    await repo.list();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("supports the full CRUD contract", async () => {
    const created = await repo.create(draft);
    expect(created.id).toBeTruthy();
    expect(await repo.get(created.id)).toMatchObject({ name: draft.name });

    const updated = await repo.update(created.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    expect((await repo.get(created.id)).status).toBe("paused");

    await repo.delete(created.id);
    await expect(repo.get(created.id)).rejects.toBeInstanceOf(ApiError);
  });

  it("persists across repository instances (localStorage-backed)", async () => {
    const created = await repo.create(draft);
    const fresh = new DemoStudentRepository();
    await expect(fresh.get(created.id)).resolves.toMatchObject({ id: created.id });
  });

  it("throws a not_found ApiError for unknown ids", async () => {
    const error = (await repo.get("nope").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("not_found");
    expect(error.code).toBe("STUDENT_NOT_FOUND");
    await expect(repo.update("nope", {})).rejects.toBeInstanceOf(ApiError);
    await expect(repo.delete("nope")).rejects.toBeInstanceOf(ApiError);
  });

  it("does not mutate the seed dataset", async () => {
    await repo.update(seedStudents[0].id, { name: "تغییر یافته" });
    expect(seedStudents[0].name).not.toBe("تغییر یافته");
  });
});
