/**
 * Persian dates through the compensation path.
 *
 * The operator types a Jalali date; the session is stored as ISO. That bridge is
 * the scheduling domain's (`dateBridge.jalaliToIso`), and this file exists because
 * a compensation booked on "۱۴۰۶/۰۱/۱۵" must land on the right Gregorian day —
 * an off-by-one here books a make-up on the wrong day and nobody notices until
 * the family arrives.
 *
 * Only the fail-closed half needed asserting: the bridge returns `null` for a date
 * that does not exist, and nothing in this domain may turn that into a session.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoAttendanceRepository } from "@/domains/attendance/demoRepository";
import { jalaliToIso } from "@/domains/scheduling/dateBridge";
import { DemoSchedulingRepository } from "@/domains/scheduling/demoRepository";
import { SESSION_ERRORS } from "@/domains/scheduling/types";
import { demoStore } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { DemoCompensationRepository } from "../demoRepository";

const PRIVATE_CLASS = "cl2";
const PRIVATE_STUDENT = "st7";
const ACTOR = "usr_admin";
/** ۱۴۰۶/۰۱/۱۵ — outside the seeded window, so nothing can collide with it. */
const JALALI_MAKEUP = "۱۴۰۶/۰۱/۱۵";
const ISO_MAKEUP = "2027-04-04";
/** The original's own date (cl2 meets on day index 3). */
const ORIGINAL_DATE = "2027-05-11";

let repo: DemoCompensationRepository;
let scheduling: DemoSchedulingRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  const attendance = new DemoAttendanceRepository(demoStore);
  scheduling = new DemoSchedulingRepository(demoStore, () => attendance.sessionIdsWithAttendanceSync());
  repo = new DemoCompensationRepository(demoStore, { scheduling, attendance });
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (cause) {
    return cause instanceof ApiError ? (cause.code ?? "UNKNOWN") : "UNKNOWN";
  }
}

describe("Jalali dates", () => {
  it("books the make-up on the Gregorian day the operator typed", async () => {
    expect(jalaliToIso(JALALI_MAKEUP)).toBe(ISO_MAKEUP);

    const original = await scheduling.create({
      classId: PRIVATE_CLASS,
      date: ORIGINAL_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await scheduling.cancelSession(original.id, "لغو");
    const compensation = await repo.register({
      originalSessionId: original.id,
      studentId: PRIVATE_STUDENT,
      reason: "لغو جلسه",
      requiredByUserId: ACTOR,
    });

    const booked = await repo.schedule(compensation.id, {
      date: jalaliToIso(JALALI_MAKEUP)!,
      startTime: "09:00",
      endTime: "09:30",
      roomId: "r3",
      teacherId: "t2",
      acknowledgeWarnings: true,
      scheduledByUserId: ACTOR,
    });

    expect(booked.status).toBe("scheduled");
    const session = await scheduling.get(booked.currentAttempt!.sessionId);
    expect(session.date).toBe(ISO_MAKEUP);
    // The Jalali date is what the operator will read back out of the calendar.
    expect(session.date).not.toBe(ORIGINAL_DATE);
  });

  it("refuses a date that does not exist instead of guessing a neighbour", async () => {
    // Esfand has 30 days only in a leap year, and 1404 is not one.
    expect(jalaliToIso("۱۴۰۴/۱۲/۳۰")).toBeNull();
    // The same day one year earlier does exist, which is why this is a real check.
    expect(jalaliToIso("۱۴۰۳/۱۲/۳۰")).toBe("2025-03-20");

    const original = await scheduling.create({
      classId: PRIVATE_CLASS,
      date: ORIGINAL_DATE,
      startTime: "14:00",
      endTime: "15:00",
      teacherId: "t1",
      roomId: "r1",
    });
    await scheduling.cancelSession(original.id, "لغو");
    const compensation = await repo.register({
      originalSessionId: original.id,
      studentId: PRIVATE_STUDENT,
      reason: "لغو جلسه",
      requiredByUserId: ACTOR,
    });

    // A `null` from the bridge must never reach a session. The scheduling
    // domain's own shape validation is what refuses it.
    expect(
      await codeOf(
        repo.schedule(compensation.id, {
          date: "",
          startTime: "09:00",
          endTime: "09:30",
          scheduledByUserId: ACTOR,
        }),
      ),
    ).toBe(SESSION_ERRORS.INVALID);
    expect((await repo.get(compensation.id)).attempts).toHaveLength(0);
  });
});
