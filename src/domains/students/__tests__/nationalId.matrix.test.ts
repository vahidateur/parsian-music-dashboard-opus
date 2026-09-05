/**
 * §9 national_id invariant matrix at the repository boundary.
 *
 * The pure algorithm is covered in `src/lib/__tests__/nationalId.test.ts`.
 * These cases assert the *domain* enforcement: missing, invalid, valid,
 * duplicate-on-create, and collision-on-update.
 *
 * BACKEND REQUIRED: these are in-process checks and are racy by construction.
 * Production must additionally enforce UNIQUE(organization_id, national_id).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { students as seedStudents } from "@/data/records";
import { demoStore } from "@/services/demoStore";
import { DemoStudentRepository } from "@/domains/students/demoRepository";
import type { CreateStudentInput } from "@/domains/students/types";

const base: CreateStudentInput = {
  nationalId: "2000535658",
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
  phone: "۰۹۱۲ ··· ۹۹۹۹",
  lastSeen: "امروز",
  balance: 0,
};

async function expectApiError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((error: unknown) => {
    expect((error as ApiError).code).toBe(code);
  });
}

describe("student national_id invariant", () => {
  let repo: DemoStudentRepository;

  beforeEach(() => {
    demoStore.reset();
    repo = new DemoStudentRepository();
  });

  it("rejects a missing national id", async () => {
    await expectApiError(repo.create({ ...base, nationalId: "   " }), "STUDENT_INVALID");
  });

  it("rejects a checksum-invalid national id", async () => {
    await expectApiError(repo.create({ ...base, nationalId: "1234567890" }), "STUDENT_INVALID");
  });

  it("rejects a national id made of one repeated digit", async () => {
    await expectApiError(repo.create({ ...base, nationalId: "1111111111" }), "STUDENT_INVALID");
  });

  it("accepts and normalizes a valid national id", async () => {
    // Persian digits and a short (9-digit) form both normalize to the same code.
    const created = await repo.create({ ...base, nationalId: "۲۰۰۰۵۳۵۶۵۸" });
    expect(created.nationalId).toBe("2000535658");
  });

  it("rejects a duplicate of a seeded national id on create", async () => {
    const existing = seedStudents[0].nationalId;
    await expectApiError(repo.create({ ...base, nationalId: existing }), "STUDENT_NATIONAL_ID_TAKEN");
  });

  it("rejects an update that collides with another student", async () => {
    const [first, second] = seedStudents;
    await expectApiError(
      repo.update(second.id, { nationalId: first.nationalId }),
      "STUDENT_NATIONAL_ID_TAKEN",
    );
  });

  it("allows an update that keeps the student's own national id", async () => {
    const target = seedStudents[0];
    const updated = await repo.update(target.id, { nationalId: target.nationalId, name: "نام تازه" });
    expect(updated.nationalId).toBe(target.nationalId);
    expect(updated.name).toBe("نام تازه");
  });
});
