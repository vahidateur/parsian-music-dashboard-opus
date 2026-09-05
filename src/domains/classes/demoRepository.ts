import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, matchesQuery, notFound, paginate, sortRows, validationError } from "@/domains/shared/demoCollection";
import { isRoomAssignable } from "@/domains/rooms/demoRepository";
import type { Page } from "@/api/types";
import type { Room } from "@/domains/rooms/types";
import type { ClassRepository } from "./repository";
import type { AcademyClass, ClassListParams, CreateClassInput, UpdateClassInput } from "./types";

export const isClassActive = (cls: AcademyClass): boolean => cls.status !== "archived";

export class DemoClassRepository implements ClassRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(params: ClassListParams = {}): Promise<Page<AcademyClass>> {
    const filtered = this.store.classes.all().filter((c) => {
      if (params.instrument && c.instrument !== params.instrument) return false;
      if (params.teacherId && c.teacherId !== params.teacherId) return false;
      if (params.roomId && c.roomId !== params.roomId) return false;
      const status = c.status ?? "active";
      if (params.status && status !== params.status) return false;
      // Archived classes are excluded by default: they are history, not
      // operational data. Callers must opt in explicitly.
      if (!params.status && !params.includeArchived && status === "archived") return false;
      if (params.assignableOnly && !isClassActive(c)) return false;
      return matchesQuery([c.title, c.level], params.search);
    });
    const key =
      params.sort === "enrolled"
        ? (c: AcademyClass) => c.enrolled
        : params.sort === "capacity"
          ? (c: AcademyClass) => c.capacity
          : (c: AcademyClass) => c.title;
    return paginate(sortRows(filtered, key, params.dir), params);
  }

  async get(id: string): Promise<AcademyClass> {
    const found = this.store.classes.find(id);
    if (!found) throw classNotFound(id);
    return found;
  }

  async create(input: CreateClassInput): Promise<AcademyClass> {
    this.validateRelations(input);
    return this.store.classes.create({
      attendanceAvg: 0,
      termProgress: 0,
      ...input,
      status: input.status ?? "active",
      studentIds: [],
      enrolled: 0,
      waitlist: 0,
    });
  }

  async update(id: string, input: UpdateClassInput): Promise<AcademyClass> {
    const existing = this.store.classes.find(id);
    if (!existing) throw classNotFound(id);
    this.validateRelations({ ...existing, ...input }, true);

    // Capacity may not drop below current active enrollment.
    if (input.capacity !== undefined) {
      const active = this.store.enrollments.all().filter((e) => e.classId === id && e.status === "active").length;
      if (input.capacity < active) {
        throw conflict("CLASS_CAPACITY_BELOW_ENROLLED", `ظرفیت نمی‌تواند کمتر از ${active} هنرجوی ثبت‌نام‌شده باشد.`, {
          capacity: ["کمتر از ثبت‌نام فعلی"],
        });
      }
    }
    const updated = this.store.classes.update(id, input);
    if (!updated) throw classNotFound(id);
    return updated;
  }

  async archive(id: string): Promise<AcademyClass> {
    const updated = this.store.classes.update(id, { status: "archived" });
    if (!updated) throw classNotFound(id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const enrolled = this.store.enrollments.all().filter((e) => e.classId === id);
    if (enrolled.length > 0) {
      throw conflict("CLASS_HAS_ENROLLMENTS", `این کلاس ${enrolled.length} ثبت‌نام دارد. به‌جای حذف، آن را بایگانی کنید.`);
    }
    if (!this.store.classes.remove(id)) throw classNotFound(id);
  }

  /** A class may only reference an existing, assignable teacher and room. */
  private validateRelations(input: Partial<CreateClassInput>, partial = false): void {
    const fields: Record<string, string[]> = {};
    if (!partial || input.title !== undefined) {
      if ((input.title ?? "").trim().length < 2) fields.title = ["عنوان کلاس الزامی است."];
    }
    if (!partial || input.capacity !== undefined) {
      const c = input.capacity;
      if (typeof c !== "number" || !Number.isInteger(c) || c < 1) fields.capacity = ["ظرفیت باید حداقل ۱ باشد."];
    }
    if (input.teacherId !== undefined) {
      const teacher = this.store.teachers.find(input.teacherId);
      if (!teacher) fields.teacherId = ["مدرس یافت نشد."];
      else if (teacher.status === "inactive") fields.teacherId = ["مدرس غیرفعال است."];
    }
    if (input.roomId !== undefined) {
      const room = this.store.rooms.find(input.roomId) as Room | undefined;
      if (!room) fields.roomId = ["اتاق یافت نشد."];
      else if (!isRoomAssignable(room)) fields.roomId = ["اتاق غیرفعال است."];
      else if (input.capacity !== undefined && input.capacity > room.capacity) {
        fields.capacity = [`ظرفیت کلاس از ظرفیت اتاق (${room.capacity}) بیشتر است.`];
      }
    }
    if (Object.keys(fields).length > 0) throw validationError("CLASS_INVALID", "اطلاعات کلاس معتبر نیست.", fields);
  }
}

function classNotFound(id: string) {
  return notFound("CLASS_NOT_FOUND", `کلاس با شناسهٔ ${id} یافت نشد.`);
}
