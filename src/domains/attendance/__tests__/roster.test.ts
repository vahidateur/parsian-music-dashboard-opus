/**
 * Derived session roster.
 *
 * The date-scoping rule is what makes attendance history trustworthy. Get it
 * wrong and a student who joined in week 6 appears on week 2's register, or
 * one who left in week 8 vanishes from weeks 1–7 whose attendance is already
 * recorded. Both are silent corruptions of past records, so every boundary is
 * pinned here.
 */
import { describe, expect, it } from "vitest";
import { coversDate, resolveRosterStudentIds, resolveSessionRoster, type RosterEnrollment, type RosterStudent } from "../roster";

/** 1404/07/01 → 2025-09-23; 1404/09/01 → 2025-11-22. */
const SEP_23 = "2025-09-23";
const OCT_23 = "2025-10-23";
const NOV_22 = "2025-11-22";

const students: RosterStudent[] = [
  { id: "st1", name: "الف" },
  { id: "st2", name: "ب" },
  { id: "st3", name: "پ", photoMediaId: "md_1" },
];

function enrollment(over: Partial<RosterEnrollment> = {}): RosterEnrollment {
  return {
    studentId: "st1",
    classId: "cl1",
    status: "active",
    startDate: "۱۴۰۴/۰۷/۰۱", // 2025-09-23
    ...over,
  };
}

const roster = (enrollments: RosterEnrollment[], date = OCT_23) =>
  resolveSessionRoster({ classId: "cl1", date, enrollments, students });

describe("class scoping", () => {
  it("includes only enrollments for the session's class", () => {
    const result = roster([enrollment(), enrollment({ studentId: "st2", classId: "cl9" })]);
    expect(result.map((r) => r.studentId)).toEqual(["st1"]);
  });

  it("returns an empty roster for a class with no enrollments", () => {
    expect(roster([])).toEqual([]);
  });

  it("returns an empty roster when every enrollment is for another class", () => {
    expect(roster([enrollment({ classId: "cl9" })])).toEqual([]);
  });
});

describe("status scoping", () => {
  it("includes active enrollments", () => {
    expect(roster([enrollment({ status: "active" })])).toHaveLength(1);
  });

  it("excludes waitlist, completed and cancelled", () => {
    // These are the other three members of the real EnrollmentStatus union.
    for (const status of ["waitlist", "completed", "cancelled"]) {
      expect(roster([enrollment({ status })]), status).toEqual([]);
    }
  });

  it("excludes an unrecognised status rather than admitting it", () => {
    // Matching on the one included value means a future status is excluded by
    // default — the safe direction for a rule deciding who is on a register.
    expect(roster([enrollment({ status: "some_future_state" })])).toEqual([]);
  });
});

describe("start date", () => {
  it("includes an enrollment starting before the session", () => {
    expect(roster([enrollment({ startDate: "۱۴۰۴/۰۷/۰۱" })], OCT_23)).toHaveLength(1);
  });

  it("includes an enrollment starting exactly on the session date", () => {
    // Inclusive bound: a student's first lesson is on their register.
    expect(roster([enrollment({ startDate: "۱۴۰۴/۰۷/۰۱" })], SEP_23)).toHaveLength(1);
  });

  it("EXCLUDES an enrollment starting after the session", () => {
    // A student who joins in week 6 must not appear on week 2's register.
    expect(roster([enrollment({ startDate: "۱۴۰۴/۰۹/۰۱" })], OCT_23)).toEqual([]);
  });
});

describe("end date", () => {
  it("includes an enrollment with no end date", () => {
    expect(roster([enrollment()])).toHaveLength(1);
  });

  it("INCLUDES an enrollment ending after the session", () => {
    expect(roster([enrollment({ endDate: "۱۴۰۴/۰۹/۰۱" })], OCT_23)).toHaveLength(1);
  });

  it("includes an enrollment ending exactly on the session date", () => {
    // Inclusive: a student's last lesson is still theirs.
    expect(roster([enrollment({ endDate: "۱۴۰۴/۰۹/۰۱" })], NOV_22)).toHaveLength(1);
  });

  it("EXCLUDES an enrollment that already ended", () => {
    expect(roster([enrollment({ endDate: "۱۴۰۴/۰۷/۰۱" })], OCT_23)).toEqual([]);
  });

  it("treats an empty end date as open-ended", () => {
    expect(roster([enrollment({ endDate: "" })])).toHaveLength(1);
  });
});

describe("mid-term join and withdrawal", () => {
  /**
   * The scenario the whole rule exists for: one student joins partway through
   * and another leaves, and each session's register must reflect the truth as
   * it was on that date.
   */
  const joined = enrollment({ studentId: "st2", startDate: "۱۴۰۴/۰۹/۰۱" }); // from NOV_22
  const left = enrollment({ studentId: "st3", endDate: "۱۴۰۴/۰۷/۰۱" }); // until SEP_23
  const steady = enrollment({ studentId: "st1" });
  const all = [steady, joined, left];

  it("an early session shows the steady and departing students", () => {
    expect(roster(all, SEP_23).map((r) => r.studentId).sort()).toEqual(["st1", "st3"]);
  });

  it("a later session shows the steady and newly joined students", () => {
    expect(roster(all, NOV_22).map((r) => r.studentId).sort()).toEqual(["st1", "st2"]);
  });

  it("a middle session shows only the steady student", () => {
    expect(roster(all, OCT_23).map((r) => r.studentId)).toEqual(["st1"]);
  });

  it("withdrawing later never rewrites an earlier register", () => {
    // The departing student remains on the early session after leaving —
    // history is not retroactively edited.
    const early = roster(all, SEP_23);
    expect(early.some((r) => r.studentId === "st3")).toBe(true);
  });
});

describe("failing closed", () => {
  it("EXCLUDES a student whose start date cannot be parsed", () => {
    // Silently admitting someone is the worse error: an over-strict roster is
    // visible, a wrongly-included student is not.
    for (const bad of ["not-a-date", "", "1404", "۱۴۰۴/۱۳/۰۱", "1404/07/32"]) {
      expect(roster([enrollment({ startDate: bad })]), bad).toEqual([]);
    }
  });

  /**
   * START and END dates fail in OPPOSITE directions, deliberately.
   *
   * This asymmetry was challenged in a gate audit; the domain contract
   * settles it:
   *
   *   - `startDate` is REQUIRED (`startDate: string`) and every production
   *     writer sets a real Jalali date. An unparseable one means the record
   *     is corrupt, and we cannot show a student is enrolled — exclude.
   *
   *   - `endDate` is OPTIONAL (`endDate?: string`) and is written by exactly
   *     one production path: `DemoEnrollmentRepository.withdraw()`, which
   *     sets `{ status: "cancelled", endDate: "امروز" }`. `"امروز"` ("today")
   *     is a DISPLAY string that `jalaliToIso` correctly returns null for.
   *
   * So an unparseable `endDate` is the NORMAL state of a withdrawn
   * enrollment, not corruption. Such a student is already excluded by the
   * status gate, which runs first — the end date is never even read.
   *
   * Excluding on a malformed end date would therefore protect nothing and
   * would silently drop an ACTIVE student from every register the moment any
   * non-ISO end date reached the field, making their attendance impossible to
   * record. Retaining them is the safe direction here.
   */
  it("keeps an ACTIVE student when only the END date is unparseable", () => {
    // The enrollment demonstrably started; dropping them would hide a real
    // attendance obligation.
    expect(roster([enrollment({ endDate: "garbage" })])).toHaveLength(1);
  });

  it("keeps an active student whose end date is the literal withdraw() value", () => {
    // "امروز" is precisely what withdraw() writes. If it ever appears while
    // the status is still active, the student must remain on the register.
    expect(roster([enrollment({ endDate: "امروز" })])).toHaveLength(1);
  });

  it("excludes a withdrawn student by STATUS, before the end date is consulted", () => {
    // The real shape withdraw() produces. Exclusion must come from the status
    // gate, so it holds regardless of whether the end date parses.
    const withdrawn = enrollment({ status: "cancelled", endDate: "امروز" });
    expect(roster([withdrawn])).toEqual([]);

    // Same status, but with a perfectly parseable end date — still excluded,
    // proving the status gate is what does the work.
    expect(roster([enrollment({ status: "cancelled", endDate: "۱۴۰۴/۰۹/۰۱" })])).toEqual([]);
  });

  it("treats a MALFORMED start and a MALFORMED end differently, on purpose", () => {
    // Start unparseable => excluded (cannot prove enrollment began).
    expect(roster([enrollment({ startDate: "garbage" })])).toEqual([]);
    // End unparseable   => retained (enrollment provably began, no proven end).
    expect(roster([enrollment({ endDate: "garbage" })])).toHaveLength(1);
  });

  it("does not throw on malformed input", () => {
    expect(() => roster([enrollment({ startDate: undefined as unknown as string })])).not.toThrow();
  });
});

describe("data integrity", () => {
  it("skips an enrollment pointing at a missing student", () => {
    expect(roster([enrollment({ studentId: "st_gone" })])).toEqual([]);
  });

  it("lists a student once even with duplicate enrollments", () => {
    const result = roster([enrollment(), enrollment()]);
    expect(result).toHaveLength(1);
  });

  it("carries the student's name and photo through", () => {
    const result = roster([enrollment({ studentId: "st3" })]);
    expect(result[0]).toEqual({ studentId: "st3", studentName: "پ", photoMediaId: "md_1" });
  });
});

describe("ordering", () => {
  it("sorts by Persian name so the register reads consistently", () => {
    const result = roster([
      enrollment({ studentId: "st3" }),
      enrollment({ studentId: "st1" }),
      enrollment({ studentId: "st2" }),
    ]);
    expect(result.map((r) => r.studentName)).toEqual(["الف", "ب", "پ"]);
  });

  it("is stable regardless of enrollment order", () => {
    const a = roster([enrollment({ studentId: "st1" }), enrollment({ studentId: "st2" })]);
    const b = roster([enrollment({ studentId: "st2" }), enrollment({ studentId: "st1" })]);
    expect(a).toEqual(b);
  });
});

describe("coversDate", () => {
  it("is inclusive at both bounds", () => {
    const e = enrollment({ startDate: "۱۴۰۴/۰۷/۰۱", endDate: "۱۴۰۴/۰۹/۰۱" });
    expect(coversDate(e, SEP_23)).toBe(true);
    expect(coversDate(e, NOV_22)).toBe(true);
    expect(coversDate(e, OCT_23)).toBe(true);
  });

  it("rejects dates outside the window", () => {
    const e = enrollment({ startDate: "۱۴۰۴/۰۹/۰۱" });
    expect(coversDate(e, SEP_23)).toBe(false);
  });
});

describe("resolveRosterStudentIds", () => {
  it("returns ids in the same order as the full roster", () => {
    const enrollments = [enrollment({ studentId: "st2" }), enrollment({ studentId: "st1" })];
    expect(resolveRosterStudentIds({ classId: "cl1", date: OCT_23, enrollments, students })).toEqual([
      "st1",
      "st2",
    ]);
  });
});
