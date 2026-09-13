import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { conflict, validationError } from "@/domains/shared/demoCollection";
import { NATIONAL_ID_MESSAGES, normalizeNationalId, validateNationalId } from "@/lib/nationalId";
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
    const nationalId = this.assertNationalId(input.nationalId);
    return this.store.students.create({ notes: [], activity: [], skills: [], ...input, nationalId });
  }

  async update(id: string, input: UpdateStudentInput): Promise<Student> {
    const patch = { ...input };
    if (input.nationalId !== undefined) {
      // Update collisions must be caught too, excluding the row being edited.
      patch.nationalId = this.assertNationalId(input.nationalId, id);
    }
    const updated = this.store.students.update(id, patch);
    if (!updated) throw notFound(id);
    return updated;
  }

  /**
   * Validates the checksum and enforces academy-wide uniqueness.
   * Returns the normalized value that must actually be stored.
   *
   * BACKEND REQUIRED: this is a convenience check. Production needs
   * NOT NULL + UNIQUE(organization_id, national_id) enforced by the database,
   * because two concurrent creates can both pass this check.
   */
  private assertNationalId(raw: string, exceptId?: string): string {
    const code = validateNationalId(raw ?? "");
    if (code) {
      throw validationError("STUDENT_INVALID", "اطلاعات هنرجو معتبر نیست.", {
        nationalId: [NATIONAL_ID_MESSAGES[code]],
      });
    }
    const normalized = normalizeNationalId(raw);
    const taken = this.store.students.all().some((s) => s.nationalId === normalized && s.id !== exceptId);
    if (taken) {
      throw conflict("STUDENT_NATIONAL_ID_TAKEN", "هنرجوی دیگری با این کد ملی ثبت شده است.", {
        nationalId: ["تکراری است"],
      });
    }
    return normalized;
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
