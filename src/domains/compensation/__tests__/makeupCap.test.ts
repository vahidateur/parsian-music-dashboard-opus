/**
 * THE MAKE-UP CEILING — one academy rule, enforced where make-ups are created.
 *
 * The number lives in Settings → قواعد جلسه, and this file pins the two things
 * that make it a rule rather than a label:
 *
 *   • it is enforced in the REPOSITORY, so every caller — a dialog today, an
 *     import or an API path tomorrow — meets the same ceiling;
 *   • it is the academy's number, not a constant: raising it in Settings raises
 *     it here, and setting it to zero means the academy does not offer make-ups
 *     at all.
 *
 * The refusal is a conflict, not a validation error: the request is well-formed
 * and the session is genuinely cancellable. The academy's policy says no, and the
 * message says which policy and where to change it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { permissionsForRole } from "@/domains/auth/permissions";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { DemoOrganizationRepository } from "@/domains/organization/demoRepository";
import { demoStore, type DemoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";
import { COMPENSATION_ERRORS, type CompensationActor } from "../types";

/** A seeded PRIVATE class with exactly one enrolled student. */
const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
/** cl2 meets on weekday index 3; these are three of its own future dates. */
const DATES = ["2027-05-11", "2027-05-18", "2027-05-25"];

const ACTOR: CompensationActor = {
  userId: "usr_admin",
  permissions: permissionsForRole("administrator"),
};

let store: DemoStore;
let repo: DemoCompensationRepository;
let scheduling: DemoSchedulingRepository;
let organization: DemoOrganizationRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  store = demoStore;
  const attendance = new DemoAttendanceRepository(store);
  scheduling = new DemoSchedulingRepository(store, () => attendance.sessionIdsWithAttendanceSync());
  repo = new DemoCompensationRepository(store, { scheduling, attendance });
  organization = new DemoOrganizationRepository(store);
});

/** Cancels a fresh private session and registers the make-up it entitles. */
async function registerOne(date: string) {
  const created = await scheduling.create({
    classId: PRIVATE_CLASS,
    date,
    startTime: "14:00",
    endTime: "15:00",
    teacherId: "t1",
    roomId: "r1",
  });
  await scheduling.cancelSession(created.id, "بیماری هنرجو");
  return repo.register({
    originalSessionId: created.id,
    studentId: PRIVATE_STUDENT,
    reason: "جلسهٔ از دست رفته",
    actor: ACTOR,
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

describe("the ceiling", () => {
  it("lets a student have exactly as many make-ups as the academy allows", async () => {
    expect((await organization.get()).maxMakeupsPerTerm).toBe(2);

    await registerOne(DATES[0]);
    await registerOne(DATES[1]);
    expect(store.sessionCompensations.all().filter((row) => row.studentId === PRIVATE_STUDENT)).toHaveLength(2);

    const refusal = await codeOf(registerOne(DATES[2]));
    expect(refusal).toBe(COMPENSATION_ERRORS.MAKEUP_CAP_REACHED);
    // The refusal wrote nothing.
    expect(store.sessionCompensations.all().filter((row) => row.studentId === PRIVATE_STUDENT)).toHaveLength(2);
  });

  it("counts a settled make-up as one the academy already gave", async () => {
    const first = await registerOne(DATES[0]);
    // Booked and discharged: the make-up happened, so the obligation is terminal.
    await repo.schedule(first.id, { date: DATES[0], startTime: "16:00", endTime: "17:00", actor: ACTOR });
    await repo.complete(first.id, { actor: ACTOR });
    await registerOne(DATES[1]);
    expect(await codeOf(registerOne(DATES[2]))).toBe(COMPENSATION_ERRORS.MAKEUP_CAP_REACHED);
  });

  it("is the academy's number: raising it in Settings raises it here", async () => {
    await registerOne(DATES[0]);
    await registerOne(DATES[1]);
    expect(await codeOf(registerOne(DATES[2]))).toBe(COMPENSATION_ERRORS.MAKEUP_CAP_REACHED);

    await organization.update({ maxMakeupsPerTerm: 3 });
    const third = await registerOne(DATES[2]);
    expect(third.studentId).toBe(PRIVATE_STUDENT);
    expect(store.sessionCompensations.all().filter((row) => row.studentId === PRIVATE_STUDENT)).toHaveLength(3);
  });

  it("means no make-ups at all when the academy sets it to zero", async () => {
    await organization.update({ maxMakeupsPerTerm: 0 });
    const refusal = await codeOf(registerOne(DATES[0]));
    expect(refusal).toBe(COMPENSATION_ERRORS.MAKEUP_CAP_REACHED);
    expect(store.sessionCompensations.all()).toHaveLength(0);
  });

  it("counts per student, not per academy", async () => {
    await registerOne(DATES[0]);
    await registerOne(DATES[1]);
    // The ceiling is full for st7 — another student is unaffected by it.
    expect(await codeOf(registerOne(DATES[2]))).toBe(COMPENSATION_ERRORS.MAKEUP_CAP_REACHED);
    expect(store.sessionCompensations.all().every((row) => row.studentId === PRIVATE_STUDENT)).toBe(true);
  });

  it("says which rule refused, and where to change it", async () => {
    await registerOne(DATES[0]);
    await registerOne(DATES[1]);
    const error = (await registerOne(DATES[2]).catch((cause) => cause)) as ApiError;
    expect(error.kind).toBe("conflict");
    expect(error.message).toContain("سقف جلسات جبرانی");
    expect(error.message).toContain("قواعد جلسه");
  });
});
