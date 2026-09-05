import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { demoStore, type DemoStore } from "@/services/demoStore";
import type { StudentRepository } from "./repository";
import type { CreateStudentInput, Student, StudentListParams, UpdateStudentInput } from "./types";

const DEFAULT_PER_PAGE = 25;

/**
 * Implementation #1 — adapts the DemoStore to the domain contract.
 * It owns *no* persistence: filtering/paging only, so that demo and API modes
 * present identical semantics to the views.
 */
export class DemoStudentRepository implements StudentRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(params: StudentListParams = {}): Promise<Page<Student>> {
    const filtered = this.store.students.all().filter((s) => matches(s, params));
    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.max(1, params.per_page ?? DEFAULT_PER_PAGE);
    const start = (page - 1) * perPage;
    return {
      data: filtered.slice(start, start + perPage),
      meta: { page, per_page: perPage, total: filtered.length },
    };
  }

  async get(id: string): Promise<Student> {
    const found = this.store.students.find(id);
    if (!found) throw notFound(id);
    return found;
  }

  async create(input: CreateStudentInput): Promise<Student> {
    return this.store.students.create({ notes: [], activity: [], skills: [], ...input });
  }

  async update(id: string, input: UpdateStudentInput): Promise<Student> {
    const updated = this.store.students.update(id, input);
    if (!updated) throw notFound(id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.students.remove(id)) throw notFound(id);
  }
}

function notFound(id: string): ApiError {
  return new ApiError({ kind: "not_found", code: "STUDENT_NOT_FOUND", message: `هنرجو با شناسهٔ ${id} یافت نشد.` });
}

function matches(student: Student, params: StudentListParams): boolean {
  if (params.status && student.status !== params.status) return false;
  if (params.instrument && student.instrument !== params.instrument) return false;
  if (params.payment && student.payment !== params.payment) return false;
  if (params.teacherId && student.teacherId !== params.teacherId) return false;
  const q = params.search?.trim();
  if (!q) return true;
  const haystack = `${student.name} ${student.phone} ${student.level} ${student.guardian ?? ""}`;
  return haystack.includes(q);
}
