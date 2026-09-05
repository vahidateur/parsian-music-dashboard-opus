/**
 * §11 enrollment/waitlist invariants at the demo repository boundary.
 *
 * BACKEND REQUIRED: capacity and one-open-enrollment-per-student are enforced
 * here in-process and are therefore racy. Production needs a transactional
 * capacity check plus a partial UNIQUE(student_id, class_id) over open statuses.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { demoStore } from "@/services/demoStore";
import { DemoEnrollmentRepository } from "@/domains/enrollments/demoRepository";
import { DemoClassRepository } from "@/domains/classes/demoRepository";

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return (error as ApiError).code ?? "";
  }
  throw new Error("expected the promise to reject");
}

describe("DemoEnrollmentRepository", () => {
  let repo: DemoEnrollmentRepository;
  let classes: DemoClassRepository;

  beforeEach(() => {
    demoStore.reset();
    repo = new DemoEnrollmentRepository();
    classes = new DemoClassRepository();
  });

  it("rejects an unknown student", async () => {
    expect(await codeOf(repo.enroll({ studentId: "nope", classId: "cl1" }))).toBe("ENROLLMENT_INVALID");
  });

  it("rejects an unknown class", async () => {
    expect(await codeOf(repo.enroll({ studentId: "st1", classId: "nope" }))).toBe("ENROLLMENT_INVALID");
  });

  it("rejects a second open enrollment for the same student and class", async () => {
    const first = await repo.list({ classId: "cl6", activeOnly: true, per_page: 100 });
    const seated = first.data[0];
    expect(seated).toBeDefined();
    expect(await codeOf(repo.enroll({ studentId: seated.studentId, classId: "cl6" }))).toBe(
      "ENROLLMENT_DUPLICATE",
    );
  });

  it("refuses to seat past capacity but accepts an explicit waitlist entry", async () => {
    // cl2 is a private class with capacity 1 and one seated student.
    expect(await codeOf(repo.enroll({ studentId: "st1", classId: "cl2" }))).toBe("CLASS_FULL");

    const queued = await repo.enroll({ studentId: "st1", classId: "cl2", status: "waitlist" });
    expect(queued.status).toBe("waitlist");

    const updated = await classes.get("cl2");
    expect(updated.waitlist).toBe(1);
    expect(updated.enrolled).toBe(1);
  });

  it("refuses to promote a waitlisted student while the class is full", async () => {
    const queued = await repo.enroll({ studentId: "st1", classId: "cl2", status: "waitlist" });
    expect(await codeOf(repo.update(queued.id, { status: "active" }))).toBe("CLASS_FULL");
  });

  it("frees a seat on withdrawal and keeps the class projection in sync", async () => {
    const before = await classes.get("cl2");
    const seated = (await repo.list({ classId: "cl2", activeOnly: true, per_page: 100 })).data[0];

    await repo.withdraw(seated.id);

    const after = await classes.get("cl2");
    expect(after.enrolled).toBe(before.enrolled - 1);
    expect(after.studentIds).not.toContain(seated.studentId);

    // The freed seat is now usable.
    const promoted = await repo.enroll({ studentId: "st1", classId: "cl2" });
    expect(promoted.status).toBe("active");
  });

  it("rejects enrollment into an archived class", async () => {
    await classes.archive("cl10");
    expect(await codeOf(repo.enroll({ studentId: "st1", classId: "cl10" }))).toBe("CLASS_ARCHIVED");
  });
});
