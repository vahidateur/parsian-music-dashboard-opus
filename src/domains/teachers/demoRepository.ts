import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, matchesQuery, notFound, paginate, sortRows, validationError } from "@/domains/shared/demoCollection";
import type { Page } from "@/api/types";
import type { TeacherRepository } from "./repository";
import type { CreateTeacherInput, Teacher, TeacherListParams, UpdateTeacherInput } from "./types";

/**
 * Implementation #1 — adapts the DemoStore to the Teacher contract.
 * Filtering/paging only: the store owns persistence, so demo and API present
 * identical semantics to the views.
 */
export class DemoTeacherRepository implements TeacherRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(params: TeacherListParams = {}): Promise<Page<Teacher>> {
    const filtered = this.store.teachers.all().filter((t) => {
      if (params.instrument && t.instrument !== params.instrument) return false;
      if (params.status && t.status !== params.status) return false;
      if (params.assignableOnly && t.status === "inactive") return false;
      return matchesQuery([t.name, t.phone, t.title], params.search);
    });
    const key =
      params.sort === "utilization"
        ? (t: Teacher) => t.utilization
        : params.sort === "students"
          ? (t: Teacher) => t.students
          : (t: Teacher) => t.name;
    return paginate(sortRows(filtered, key, params.dir), params);
  }

  async get(id: string): Promise<Teacher> {
    const found = this.store.teachers.find(id);
    if (!found) throw teacherNotFound(id);
    return found;
  }

  async create(input: CreateTeacherInput): Promise<Teacher> {
    validate(input);
    this.assertPhoneFree(input.phone);
    return this.store.teachers.create({ todayClasses: [], availability: [], ...input });
  }

  async update(id: string, input: UpdateTeacherInput): Promise<Teacher> {
    validate(input, true);
    if (input.phone !== undefined) this.assertPhoneFree(input.phone, id);
    const updated = this.store.teachers.update(id, input);
    if (!updated) throw teacherNotFound(id);
    return updated;
  }

  /** Soft-deactivate. Assigned classes keep referencing the teacher on purpose. */
  async deactivate(id: string): Promise<Teacher> {
    const updated = this.store.teachers.update(id, { status: "inactive" });
    if (!updated) throw teacherNotFound(id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    // Refuse to orphan classes — deactivate instead.
    const assigned = this.store.classes.all().filter((c) => c.teacherId === id);
    if (assigned.length > 0) {
      throw conflict(
        "TEACHER_HAS_CLASSES",
        `این مدرس به ${assigned.length} کلاس اختصاص دارد. ابتدا کلاس‌ها را واگذار کنید یا مدرس را غیرفعال کنید.`,
      );
    }
    if (!this.store.teachers.remove(id)) throw teacherNotFound(id);
  }

  private assertPhoneFree(phone: string, exceptId?: string): void {
    const taken = this.store.teachers.all().some((t) => t.phone === phone && t.id !== exceptId);
    if (taken) {
      throw conflict("TEACHER_PHONE_TAKEN", "مدرس دیگری با این شمارهٔ تماس ثبت شده است.", { phone: ["تکراری است"] });
    }
  }
}

function teacherNotFound(id: string) {
  return notFound("TEACHER_NOT_FOUND", `مدرس با شناسهٔ ${id} یافت نشد.`);
}

function validate(input: Partial<CreateTeacherInput>, partial = false): void {
  const fields: Record<string, string[]> = {};
  const has = (k: keyof CreateTeacherInput) => !partial || input[k] !== undefined;
  if (has("name") && (input.name ?? "").trim().length < 2) fields.name = ["نام مدرس الزامی است."];
  // The demo dataset stores partially masked numbers ("۰۹۱۲ ··· ۴۵۱۲"), so the
  // mask character is accepted here. BACKEND REQUIRED: production must validate
  // and store a normalized E.164 number, and mask only at render time.
  if (has("phone") && !/^[0-9۰-۹\s+·-]{6,}$/.test((input.phone ?? "").trim())) fields.phone = ["شمارهٔ تماس معتبر نیست."];
  if (input.contractHours !== undefined && input.contractHours < 0) fields.contractHours = ["ساعت قرارداد نمی‌تواند منفی باشد."];
  if (Object.keys(fields).length > 0) {
    throw validationError("TEACHER_INVALID", "اطلاعات مدرس معتبر نیست.", fields);
  }
}
