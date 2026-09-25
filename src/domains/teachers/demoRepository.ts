import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, matchesQuery, notFound, paginate, sortRows, validationError } from "@/domains/shared/demoCollection";
import { DemoMediaRepository } from "@/domains/media/demoRepository";
import { mediaStillReferenced } from "@/domains/media/demoReferences";
import { releaseUnreferencedMedia } from "@/domains/media/release";
import type { MediaRepository } from "@/domains/media/repository";
import type { Page } from "@/api/types";
import type { TeacherRepository } from "./repository";
import type { CreateTeacherInput, Teacher, TeacherListParams, UpdateTeacherInput } from "./types";

/**
 * Implementation #1 — adapts the DemoStore to the Teacher contract.
 * Filtering/paging only: the store owns persistence, so demo and API present
 * identical semantics to the views.
 *
 * The record→photo ownership transition is the exception, and it is owned here:
 * the photo is part of the record this repository writes, and the shared-photo
 * check needs the dataset (`media/demoReferences.ts`).
 */
export class DemoTeacherRepository implements TeacherRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly media: MediaRepository = new DemoMediaRepository(),
  ) {}

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
    const existing = this.store.teachers.find(id);
    const updated = this.store.teachers.update(id, input);
    if (!updated) throw teacherNotFound(id);
    this.syncAccount(updated);

    /*
      OWNERSHIP TRANSITION — after the write, never before it. A replaced or
      cleared photo is freed only once the record has stopped referencing it, and
      only if no student or teacher still shows it.
    */
    if ("photoMediaId" in input && existing?.photoMediaId !== updated.photoMediaId) {
      await this.releasePhoto(existing?.photoMediaId);
    }
    return updated;
  }

  /** Soft-deactivate. Assigned classes keep referencing the teacher on purpose. */
  async deactivate(id: string): Promise<Teacher> {
    const updated = this.store.teachers.update(id, { status: "inactive" });
    if (!updated) throw teacherNotFound(id);
    this.syncAccount(updated);
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
    // Read before removing: `remove` reports only whether a row went.
    const existing = this.store.teachers.find(id);
    if (!this.store.teachers.remove(id)) throw teacherNotFound(id);
    // The login account of a teacher who no longer exists cannot stay open.
    for (const account of this.store.users.all().filter((u) => u.teacherId === id)) {
      this.store.users.update(account.id, { status: "disabled" });
    }
    /*
      Ownership transition LAST, after the record is gone: the teacher's
      photograph is freed only if no remaining student or teacher still shows it
      — a photo shared with a student outlives the teacher record. A cleanup that
      fails is reported through the media domain and never undoes the removal.
    */
    await this.releasePhoto(existing?.photoMediaId);
  }

  /** Frees a photo no persisted record references any more (global check, X1). */
  private async releasePhoto(mediaId: string | undefined): Promise<void> {
    await releaseUnreferencedMedia(mediaId, (id) => mediaStillReferenced(this.store, id), this.media);
  }

  /**
   * ONE PERSON, ONE RECORD SET.
   *
   * A teacher who can sign in has an `AuthUser` pointing at their record
   * (`teacherId`). Editing the teacher used to leave that account with the old
   * name, so Settings listed a person the teachers page had already renamed —
   * two truths about one human. The mirror is written here, in the repository,
   * so every caller (view, import, restore) gets it without knowing about it.
   *
   * The account's ROLE and EMAIL stay its own: they are login facts, not
   * properties of a teaching contract, and a teacher record holds neither.
   */
  private syncAccount(teacher: Teacher): void {
    for (const account of this.store.users.all().filter((u) => u.teacherId === teacher.id)) {
      const patch: { name?: string; phone?: string; status?: "active" | "disabled" } = {};
      if (account.name !== teacher.name) patch.name = teacher.name;
      if (teacher.phone && account.phone !== teacher.phone) patch.phone = teacher.phone;
      /*
        One direction only: an inactive teacher cannot sign in, so the account
        closes with the contract. Re-activating the teacher does NOT re-open it —
        an administrator may have disabled that login for their own reasons, and
        a teacher edit is not the place to overrule that decision.
      */
      if (teacher.status === "inactive" && account.status !== "disabled") patch.status = "disabled";
      if (Object.keys(patch).length > 0) this.store.users.update(account.id, patch);
    }
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
